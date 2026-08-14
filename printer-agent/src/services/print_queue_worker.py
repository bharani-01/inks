"""
Sequential Print Queue Worker
=============================
Processes print jobs one-by-one in FIFO order to prevent thread lockups,
printer spooler crashes, and UI lag.
"""
import os
import queue
import threading
from pathlib import Path
from src.services.printer_service import print_pdf
from src.utils.logger import log_info, log_error


class PrintQueueWorker:
    """
    Background worker thread consuming print jobs sequentially from a FIFO queue.
    Communicates progress & events back to the UI thread via event_queue.
    """

    def __init__(self, api_client, settings, event_queue: queue.Queue):
        self._api = api_client
        self._settings = settings
        self._event_q = event_queue

        self._job_queue = queue.Queue()
        self._queued_ids = set()
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.RLock()

        self._total_batch_count = 0
        self._processed_batch_count = 0

    def start(self):
        """Start worker thread."""
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._worker_loop, name='PrintQueueWorker', daemon=True)
        self._thread.start()
        log_info("PrintQueueWorker background thread started.")

    def stop(self):
        self._stop_event.set()

    def enqueue(self, order: dict):
        """Enqueue a single order or batch of orders for printing with thread self-healing."""
        with self._lock:
            # Ensure background worker thread is active and not stopped
            if self._stop_event.is_set() or self._thread is None or not self._thread.is_alive():
                self.start()

            oid = order['id']
            self._queued_ids.add(oid)
            self._total_batch_count += 1
            self._job_queue.put(order)
            log_info(f"Enqueued order #{order.get('orderNumber')} for printing (Queue depth: {self._job_queue.qsize()})")

            # Update server status to PROCESSING
            threading.Thread(
                target=lambda: self._api.mark_processing(oid),
                name='StatusUpdateThread',
                daemon=True
            ).start()

            # Emit progress update
            self._emit_progress()
            return True

    def enqueue_all(self, orders: list[dict]):
        """Enqueue multiple orders into the sequential print queue."""
        added = 0
        for order in orders:
            if self.enqueue(order):
                added += 1
        return added

    def is_queued_or_printing(self, order_id: int) -> bool:
        with self._lock:
            return order_id in self._queued_ids

    def _emit_progress(self, active_order: dict = None):
        with self._lock:
            total = self._total_batch_count
            current = self._processed_batch_count
            is_active = not self._job_queue.empty() or current < total

            if active_order:
                self._current_active_order = active_order

            if not is_active or total == 0:
                self._current_active_order = None
                self._event_q.put({'type': 'PRINT_PROGRESS', 'active': False})
                return

            percent = min(100, int((current / total) * 100)) if total > 0 else 0
            self._event_q.put({
                'type': 'PRINT_PROGRESS',
                'active': True,
                'current': current + 1,
                'total': total,
                'percent': percent,
                'order': getattr(self, '_current_active_order', None),
            })

    def _worker_loop(self):
        self._current_active_order = None
        while not self._stop_event.is_set():
            try:
                try:
                    order = self._job_queue.get(timeout=1.0)
                except queue.Empty:
                    with self._lock:
                        if self._job_queue.empty():
                            self._total_batch_count = 0
                            self._processed_batch_count = 0
                            self._current_active_order = None
                            self._event_q.put({'type': 'PRINT_PROGRESS', 'active': False})
                    continue

                order_id = order.get('id') if isinstance(order, dict) else None
                if order_id is None:
                    log_error(f"Received invalid order object in print queue: {order}")
                    self._job_queue.task_done()
                    continue

                order_num = order.get('orderNumber', f'#{order_id}')

                try:
                    self._emit_progress(active_order=order)
                    log_info(f'🖨 Sequential Queue processing job #{order_num}…')
                    self._event_q.put({
                        'type': 'LOG',
                        'msg': f'🖨 Sequential Queue processing job #{order_num}…',
                        'severity': 'INFO',
                    })

                    # 1. Download merged print-ready PDF
                    pdf_bytes = self._api.download_pdf(order_id)
                    save_dir = Path(self._settings.save_folder)
                    save_dir.mkdir(parents=True, exist_ok=True)
                    pdf_path = save_dir / f'{order_num}.pdf'
                    pdf_path.write_bytes(pdf_bytes)

                    # 2. Print via OS printer driver with explicit user preferences
                    printer_target = self._settings.printer_name or None
                    success, msg = print_pdf(
                        str(pdf_path),
                        printer_name=printer_target,
                        copies=order.get('copies', 1),
                        color_mode=order.get('colorMode', 'BW'),
                        sides=order.get('sides', 'SINGLE'),
                        paper_size=order.get('paperSize', 'A4'),
                        orientation=order.get('orientation', 'PORTRAIT'),
                        page_range=order.get('pageRange', 'all'),
                    )

                    if success:
                        self._api.mark_printed(order_id)
                        self._api.log_activity(
                            'PRINT_SUCCESS',
                            orderId=order_id,
                            orderNumber=order_num,
                            details={'printer': printer_target or 'default'},
                        )
                        log_info(f'✓ Printed #{order_num} → {printer_target or "default printer"}')
                        self._event_q.put({
                            'type': 'LOG',
                            'msg': f'✓ Printed #{order_num} → {printer_target or "default printer"}',
                            'severity': 'INFO',
                        })
                        sheets_count = max(1, int(order.get('totalPages', 1))) * max(1, int(order.get('copies', 1)))
                        self._event_q.put({'type': 'INC_PRINTED', 'sheets': sheets_count})
                    else:
                        self._api.log_activity(
                            'PRINT_FAIL',
                            orderId=order_id,
                            orderNumber=order_num,
                            details={'error': msg},
                            severity='ERROR',
                        )
                        log_error(f'✗ Print failed for #{order_num}: {msg}')
                        self._event_q.put({
                            'type': 'LOG',
                            'msg': f'✗ Print failed for #{order_num}: {msg}',
                            'severity': 'ERROR',
                        })
                        self._event_q.put({'type': 'INC_FAILED'})

                except Exception as e:
                    log_error(f'✗ Error printing #{order_num}: {e}', exc=e)
                    self._event_q.put({
                        'type': 'LOG',
                        'msg': f'✗ Error printing #{order_num}: {e}',
                        'severity': 'ERROR',
                    })
                    self._event_q.put({'type': 'INC_FAILED'})
                finally:
                    with self._lock:
                        self._processed_batch_count += 1
                        self._queued_ids.discard(order_id)
                    self._event_q.put({'type': 'PRINT_JOB_DONE', 'orderId': order_id})
                    self._emit_progress()
                    self._job_queue.task_done()
            except Exception as loop_err:
                log_error(f"PrintQueueWorker top-level error: {loop_err}", exc=loop_err)
