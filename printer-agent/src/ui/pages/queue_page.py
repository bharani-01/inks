"""
Queue Page
==========
Shows pending print jobs as individual cards and live pop-up modal options.
"""
import os
import threading
import tkinter as tk
from tkinter import ttk
from pathlib import Path

from src.ui.theme import C, FONT, SPACE, DIM
from src.ui.widgets.components import (
    Card, Badge, PremiumButton, ScrollableFrame, SectionHeader, Divider
)
from src.utils.logger import log_click


class JobDetailsModal(tk.Toplevel):
    """Pop-up modal window displaying full order details, document metadata, and print options."""

    def __init__(self, parent, order: dict, app_controller):
        super().__init__(parent)
        self.title(f"Order #{order.get('orderNumber', 'Details')}")
        self.geometry("520x580")
        self.resizable(False, False)
        self.configure(bg=C['bg_content'])
        self.transient(parent)
        self.grab_set()

        self._order = order
        self._ctrl = app_controller
        self._build()

    def _build(self):
        order = self._order
        pad = SPACE['lg']

        # Header
        hdr = tk.Frame(self, bg=C['bg_sidebar'])
        hdr.pack(fill='x', padx=0, pady=0)

        hdr_inner = tk.Frame(hdr, bg=C['bg_sidebar'])
        hdr_inner.pack(fill='x', padx=pad, pady=SPACE['md'])

        tk.Label(
            hdr_inner, text=f"📋 Order Details #{order.get('orderNumber')}",
            font=FONT['h3'], bg=C['bg_sidebar'], fg=C['text_primary']
        ).pack(anchor='w')

        customer = order.get('user', {}).get('name', 'Customer')
        email = order.get('user', {}).get('email', '')
        tk.Label(
            hdr_inner, text=f"Customer: {customer} ({email})" if email else f"Customer: {customer}",
            font=FONT['body'], bg=C['bg_sidebar'], fg=C['text_secondary']
        ).pack(anchor='w')

        # Main scrollable body
        body = tk.Frame(self, bg=C['bg_content'])
        body.pack(fill='both', expand=True, padx=pad, pady=pad)

        # Document Card
        doc_card = Card(body)
        doc_card.pack(fill='x', pady=(0, SPACE['md']))
        doc_inner = tk.Frame(doc_card, bg=C['bg_card'])
        doc_inner.pack(fill='x', padx=SPACE['md'], pady=SPACE['md'])

        doc = order.get('document', {})
        doc_name = doc.get('originalName', 'Document')
        tk.Label(doc_inner, text=f"📄 {doc_name}", font=FONT['bold'],
                 bg=C['bg_card'], fg=C['text_primary'], wraplength=450, justify='left').pack(anchor='w')

        # Print Options Grid Card
        opts_card = Card(body)
        opts_card.pack(fill='x', pady=(0, SPACE['md']))
        opts_inner = tk.Frame(opts_card, bg=C['bg_card'])
        opts_inner.pack(fill='x', padx=SPACE['md'], pady=SPACE['md'])

        SectionHeader(opts_inner, text="Print Specifications & Options", bg=C['bg_card']).pack(fill='x', pady=(0, SPACE['sm']))

        pages = order.get('totalPages', 1)
        copies = order.get('copies', 1)
        total_sheets = pages * copies

        grid_data = [
            ("📄 Total Pages", f"{pages} page(s)"),
            ("📑 Copies", f"{copies} cop{'y' if copies == 1 else 'ies'}"),
            ("🖨 Total Sheets", f"{total_sheets} sheet(s) total"),
            ("🎨 Color Mode", order.get('colorMode', 'BW')),
            ("📐 Paper Size", order.get('paperSize', 'A4')),
            ("📐 Orientation", order.get('orientation', 'PORTRAIT').capitalize()),
            ("🔄 Print Sides", order.get('sides', 'SINGLE').replace('_', ' ').capitalize()),
            ("📚 Binding", order.get('binding', 'none').capitalize()),
            ("📄 Page Range", order.get('pageRange', 'all')),
        ]

        grid_f = tk.Frame(opts_inner, bg=C['bg_card'])
        grid_f.pack(fill='x')
        grid_f.columnconfigure(0, weight=1)
        grid_f.columnconfigure(1, weight=1)

        for i, (lbl, val) in enumerate(grid_data):
            row_f = tk.Frame(grid_f, bg=C['bg_card'])
            row_f.grid(row=i // 2, column=i % 2, sticky='w', pady=3, padx=4)

            tk.Label(row_f, text=f"{lbl}: ", font=FONT['body_sm'],
                     fg=C['text_tertiary'], bg=C['bg_card']).pack(side='left')
            tk.Label(row_f, text=str(val), font=FONT['bold'],
                     fg=C['text_primary'], bg=C['bg_card']).pack(side='left')

        # Instructions / Notes
        if order.get('instructions'):
            note_card = Card(body)
            note_card.pack(fill='x', pady=(0, SPACE['md']))
            note_inner = tk.Frame(note_card, bg=C['bg_card'])
            note_inner.pack(fill='x', padx=SPACE['md'], pady=SPACE['md'])

            SectionHeader(note_inner, text="Customer Special Instructions", bg=C['bg_card']).pack(fill='x', pady=(0, SPACE['xs']))
            tk.Label(note_inner, text=order['instructions'], font=FONT['body_sm'],
                     bg=C['bg_card'], fg=C['warning'], wraplength=450, justify='left').pack(anchor='w')

        # Action Buttons Footer
        footer = tk.Frame(self, bg=C['bg_sidebar'])
        footer.pack(fill='x', side='bottom')

        footer_inner = tk.Frame(footer, bg=C['bg_sidebar'])
        footer_inner.pack(fill='x', padx=pad, pady=SPACE['md'])

        PremiumButton(footer_inner, style='ghost', text='Close', command=self.destroy).pack(side='left')

        btn_right = tk.Frame(footer_inner, bg=C['bg_sidebar'])
        btn_right.pack(side='right')

        PremiumButton(btn_right, style='secondary', text='👁  Preview PDF',
                      command=self._preview).pack(side='left', padx=(0, SPACE['sm']))
        PremiumButton(btn_right, style='primary', text='🖨  Instant Print',
                      command=self._print_now).pack(side='left')

    def _preview(self):
        order = self._order
        try:
            self._ctrl.log(f'Downloading preview for #{order.get("orderNumber")}…')

            def _download():
                try:
                    pdf_bytes = self._ctrl.api.download_pdf(order['id'])
                    save_dir = Path(self._ctrl.settings.save_folder)
                    save_dir.mkdir(parents=True, exist_ok=True)
                    pdf_path = save_dir / f'{order.get("orderNumber")}.pdf'
                    pdf_path.write_bytes(pdf_bytes)
                    self._ctrl.log(f'Opening preview: {pdf_path.name}')
                    os.startfile(str(pdf_path))
                except Exception as e:
                    self._ctrl.log(f'Preview failed: {e}', 'ERROR')

            threading.Thread(target=_download, daemon=True).start()
        except Exception:
            pass

    def _print_now(self):
        order = self._order
        if hasattr(self._ctrl, 'print_worker'):
            self._ctrl.print_worker.enqueue(order)
            self._ctrl.log(f'⚡ Modal instant print triggered for #{order.get("orderNumber")}')
            self.destroy()


class QueuePage(tk.Frame):
    """
    Paginated Print Queue View with Sequential Print Queue integration
    and live Progress Bar.
    """

    def __init__(self, parent, app_controller, **kwargs):
        super().__init__(parent, bg=C['bg_content'], **kwargs)
        self._ctrl  = app_controller
        self._orders: list[dict] = []
        self._printing_ids: set  = set()

        # Pagination state
        self._current_page = 1
        self._per_page     = 5

        self._build()

    def _on_refresh_click(self):
        log_click('REFRESH_QUEUE_STATUS')
        if hasattr(self._ctrl, 'refresh_status'):
            self._ctrl.refresh_status()

    # ── Build UI ───────────────────────────────────────────────────────────────

    def _build(self):
        pad = SPACE['xl']

        # Page header
        header = tk.Frame(self, bg=C['bg_content'])
        header.pack(fill='x', padx=pad, pady=(pad, SPACE['sm']))

        left = tk.Frame(header, bg=C['bg_content'])
        left.pack(side='left', fill='x', expand=True)

        tk.Label(left, text='Print Queue', font=FONT['h2'],
                 bg=C['bg_content'], fg=C['text_primary']).pack(anchor='w')

        self._subtitle = tk.Label(left, text='No pending jobs',
                                  font=FONT['body'], bg=C['bg_content'],
                                  fg=C['text_secondary'])
        self._subtitle.pack(anchor='w')

        self._print_all_btn = PremiumButton(
            header, style='primary', text='🖨  Print All Queue',
            command=self._print_all,
        )
        self._print_all_btn.pack(side='right', ipady=3)
        self._print_all_btn.config(state='disabled')

        self._refresh_btn = PremiumButton(
            header, style='secondary', text='🔄 Refresh Status',
            command=self._on_refresh_click,
        )
        self._refresh_btn.pack(side='right', padx=(0, SPACE['sm']), ipady=3)

        Divider(self).pack(fill='x', padx=pad, pady=(0, SPACE['xs']))

        # ── Live Print Progress Bar Banner ────────────────────────────────────
        self._progress_card = Card(self)
        self._progress_card.pack(fill='x', padx=pad, pady=(0, SPACE['sm']))

        p_inner = tk.Frame(self._progress_card, bg=C['bg_card'])
        p_inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])

        p_top = tk.Frame(p_inner, bg=C['bg_card'])
        p_top.pack(fill='x', pady=(0, 4))

        self._progress_status_lbl = tk.Label(
            p_top, text='⚡ Sequential Printing: Job 1 of 1',
            font=FONT['bold'], bg=C['bg_card'], fg=C['accent'],
        )
        self._progress_status_lbl.pack(side='left')

        self._progress_pct_lbl = tk.Label(
            p_top, text='0%',
            font=FONT['bold'], bg=C['bg_card'], fg=C['accent'],
        )
        self._progress_pct_lbl.pack(side='right')

        # Document details & page options row
        p_doc_row = tk.Frame(p_inner, bg=C['bg_card'])
        p_doc_row.pack(fill='x', pady=(2, 4))

        self._progress_doc_lbl = tk.Label(
            p_doc_row, text='📄 Document: —',
            font=FONT['h4'], bg=C['bg_card'], fg=C['text_primary'], anchor='w'
        )
        self._progress_doc_lbl.pack(fill='x')

        self._progress_specs_lbl = tk.Label(
            p_doc_row, text='Specs: —',
            font=FONT['body_sm'], bg=C['bg_card'], fg=C['text_secondary'], anchor='w'
        )
        self._progress_specs_lbl.pack(fill='x')

        # ttk Progressbar
        style = ttk.Style(self)
        style.theme_use('default')
        style.configure(
            'Inks.Horizontal.TProgressbar',
            thickness=10,
            troughcolor=C['bg_hover'],
            background=C['accent'],
            borderwidth=0,
        )

        self._progressbar = ttk.Progressbar(
            p_inner,
            style='Inks.Horizontal.TProgressbar',
            orient='horizontal',
            mode='determinate',
        )
        self._progressbar.pack(fill='x', pady=(4, 0))

        # Hide progress card initially
        self._progress_card.pack_forget()

        # ── Scrollable job list ────────────────────────────────────────────────
        self._scroll = ScrollableFrame(self, bg=C['bg_content'])
        self._scroll.pack(fill='both', expand=True, padx=pad, pady=(0, SPACE['xs']))

        # Empty state
        self._empty = tk.Frame(self._scroll.inner, bg=C['bg_content'])
        self._empty_label = tk.Label(
            self._empty,
            text='✓  All caught up!\nNo pending print jobs.',
            font=FONT['body'],
            bg=C['bg_content'],
            fg=C['text_tertiary'],
            justify='center',
        )
        self._empty_label.pack(pady=60)
        self._empty.pack(fill='x', pady=20)

        # ── Pagination Bar Footer ─────────────────────────────────────────────
        self._pagi_bar = tk.Frame(self, bg=C['bg_content'])
        self._pagi_bar.pack(fill='x', padx=pad, pady=(0, SPACE['md']))

        self._pagi_label = tk.Label(
            self._pagi_bar, text='Page 1 of 1 (0 jobs)',
            font=FONT['body_sm'], bg=C['bg_content'], fg=C['text_secondary'],
        )
        self._pagi_label.pack(side='left')

        # Per page dropdown selector
        p_right = tk.Frame(self._pagi_bar, bg=C['bg_content'])
        p_right.pack(side='right')

        self._prev_btn = PremiumButton(
            p_right, style='secondary', text='‹ Previous',
            command=self._prev_page,
        )
        self._prev_btn.pack(side='left', padx=(0, SPACE['xs']))

        self._next_btn = PremiumButton(
            p_right, style='secondary', text='Next ›',
            command=self._next_page,
        )
        self._next_btn.pack(side='left')

    # ── Progress Bar Updates (called via main thread event handler) ───────────

    def update_progress(self, data: dict):
        active = data.get('active', False)
        if not active:
            self._progress_card.pack_forget()
            return

        if not self._progress_card.winfo_ismapped():
            self._progress_card.pack(fill='x', padx=SPACE['xl'], pady=(0, SPACE['sm']), before=self._scroll)

        current = data.get('current', 1)
        total   = data.get('total', 1)
        percent = data.get('percent', 0)
        order   = data.get('order')

        self._progress_status_lbl.config(text=f'⚡ Sequential Printing: Job {current} of {total}')
        self._progress_pct_lbl.config(text=f'{percent}%')
        self._progressbar['value'] = percent

        if order and isinstance(order, dict):
            doc_name = order.get('document', {}).get('originalName', 'Document')
            order_num = order.get('orderNumber', f'#{order.get("id")}')
            customer = order.get('user', {}).get('name', 'Customer')
            pages = order.get('totalPages', 1)
            copies = order.get('copies', 1)
            total_sheets = pages * copies

            self._progress_doc_lbl.config(text=f'📄 {doc_name}  ·  #{order_num} ({customer})')

            specs = [
                f'📄 {pages} page{"s" if pages != 1 else ""} × {copies} cop{"y" if copies == 1 else "ies"} ({total_sheets} total sheets)',
                f'Color: {order.get("colorMode", "BW")}',
                f'Paper: {order.get("paperSize", "A4")}',
                f'Sides: {order.get("sides", "SINGLE").replace("_", " ").capitalize()}',
            ]
            if order.get('binding') and order['binding'] != 'none':
                specs.append(f'Binding: {order["binding"].capitalize()}')
            if order.get('pageRange') and order['pageRange'].lower() != 'all':
                specs.append(f'Pages: {order["pageRange"]}')

            self._progress_specs_lbl.config(text='  ·  '.join(specs))

    # ── Pagination Logic ───────────────────────────────────────────────────────

    def _prev_page(self):
        if self._current_page > 1:
            self._current_page -= 1
            self.after(50, lambda: self._refresh_cards(force=True))

    def _next_page(self):
        total_pages = max(1, (len(self._orders) + self._per_page - 1) // self._per_page)
        if self._current_page < total_pages:
            self._current_page += 1
            self.after(50, lambda: self._refresh_cards(force=True))

    # ── Data Update ────────────────────────────────────────────────────────────

    def update_orders(self, orders: list[dict]):
        self._orders = sorted(
            orders,
            key=lambda o: (o.get('createdAt', '') or '', o.get('id', 0)),
            reverse=True
        )
        self.after(50, lambda: self._refresh_cards())

    def _refresh_cards(self, force: bool = False):
        if not force and not self.winfo_ismapped():
            return

        total_items = len(self._orders)
        total_pages = max(1, (total_items + self._per_page - 1) // self._per_page)

        # Bound current page
        if self._current_page > total_pages:
            self._current_page = total_pages

        fingerprint = (
            self._current_page,
            self._per_page,
            tuple((o['id'], o.get('orderStatus'), o['id'] in self._printing_ids) for o in self._orders)
        )
        if not force and getattr(self, '_current_rendered_fp', None) == fingerprint and self._scroll.inner.winfo_children():
            return
        self._current_rendered_fp = fingerprint

        # Clear all children
        for widget in self._scroll.inner.winfo_children():
            widget.destroy()

        if not self._orders:
            self._subtitle.config(text='No pending jobs')
            self._print_all_btn.config(state='disabled')
            self._pagi_label.config(text='0 jobs in queue')
            self._prev_btn.config(state='disabled')
            self._next_btn.config(state='disabled')

            empty = tk.Label(
                self._scroll.inner,
                text='🎉 All caught up!\nNo pending print jobs in queue.',
                font=FONT['body'], fg=C['text_tertiary'], bg=C['bg_content'],
                justify='center', pady=40,
            )
            empty.pack(expand=True)
            return

        self._subtitle.config(text=f'{total_items} orders waiting to print')
        self._print_all_btn.config(state='normal')

        # Slice for current page
        start_idx = (self._current_page - 1) * self._per_page
        end_idx   = start_idx + self._per_page
        page_orders = self._orders[start_idx:end_idx]

        # Update pagination bar controls
        self._pagi_label.config(text=f'Page {self._current_page} of {total_pages} ({total_items} jobs total)')
        self._prev_btn.config(state='normal' if self._current_page > 1 else 'disabled')
        self._next_btn.config(state='normal' if self._current_page < total_pages else 'disabled')

        for order in page_orders:
            self._build_job_card(order)

    def _build_job_card(self, order: dict):
        oid = order['id']
        is_printing = oid in self._printing_ids or (
            hasattr(self._ctrl, 'print_worker') and self._ctrl.print_worker.is_queued_or_printing(oid)
        )

        card = Card(self._scroll.inner)
        card.pack(fill='x', pady=(0, SPACE['sm']))

        inner = tk.Frame(card, bg=C['bg_card'])
        inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])

        # Row 1: order number + badges
        row1 = tk.Frame(inner, bg=C['bg_card'])
        row1.pack(fill='x', pady=(0, 4))

        tk.Label(
            row1, text=f'#{order["orderNumber"]}',
            font=FONT['h4'], bg=C['bg_card'], fg=C['text_primary'],
        ).pack(side='left')

        # Color mode badge
        color_preset = 'bw' if order.get('colorMode') == 'BW' else 'color'
        Badge(row1, text=order.get('colorMode', 'BW'), preset=color_preset)\
            .pack(side='left', padx=(8, 0))

        if order.get('binding') and order['binding'] != 'none':
            Badge(row1, text=order['binding'].capitalize(), preset='muted')\
                .pack(side='left', padx=(4, 0))

        if is_printing:
            Badge(row1, text='⏳ Queued / Printing…', preset='warning').pack(side='right')
        else:
            # Action buttons
            btn_frame = tk.Frame(row1, bg=C['bg_card'])
            btn_frame.pack(side='right')

            PremiumButton(
                btn_frame, style='secondary', text='📋 Details',
                command=lambda o=order: self._show_details_modal(o),
            ).pack(side='left', padx=(0, 4))

            PremiumButton(
                btn_frame, style='ghost', text='👁  Preview',
                command=lambda o=order: self._preview(o),
            ).pack(side='left', padx=(0, 4))

            PremiumButton(
                btn_frame, style='primary', text='🖨  Print',
                command=lambda o=order: self._print_one(o),
            ).pack(side='left')

        # Row 2: customer + file
        row2 = tk.Frame(inner, bg=C['bg_card'])
        row2.pack(fill='x', pady=(0, 4))

        customer = order.get('user', {}).get('name', 'Unknown')
        tk.Label(row2, text=customer, font=FONT['bold'],
                 bg=C['bg_card'], fg=C['text_primary']).pack(side='left')

        doc_name = order.get('document', {}).get('originalName', 'document')
        tk.Label(row2, text=f'  ·  {doc_name}', font=FONT['body'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(side='left')

        # Row 3: specs
        specs = self._format_specs(order)
        tk.Label(inner, text=specs, font=FONT['body_sm'],
                 bg=C['bg_card'], fg=C['text_tertiary'],
                 anchor='w').pack(fill='x')

    def _format_specs(self, order: dict) -> str:
        parts = [
            f"{order.get('totalPages', '?')} pages",
            order.get('paperSize', 'A4'),
            order.get('orientation', 'Portrait').capitalize(),
            f"{order.get('copies', 1)} cop{'y' if order.get('copies', 1) == 1 else 'ies'}",
            order.get('sides', 'SINGLE').replace('_', ' ').capitalize(),
        ]
        pr = order.get('pageRange', 'all')
        if pr and pr.lower() != 'all':
            parts.append(f'Pages: {pr}')
        if order.get('instructions'):
            parts.append(f'Note: {order["instructions"][:40]}…')
        return '  ·  '.join(parts)

    # ── Actions ────────────────────────────────────────────────────────────────

    def _print_one(self, order: dict):
        """Enqueue single job into the sequential print worker."""
        log_click('PRINT_ONE_BTN', f"Order #{order.get('orderNumber')}")
        if hasattr(self._ctrl, 'print_worker'):
            self._printing_ids.add(order['id'])
            self._ctrl.print_worker.enqueue(order)
            self.after(50, lambda: self._refresh_cards(force=True))

    def _print_all(self):
        """Enqueue all pending jobs into the sequential print worker."""
        log_click('PRINT_ALL_BTN', f"{len(self._orders)} orders")
        if hasattr(self._ctrl, 'print_worker') and self._orders:
            for order in self._orders:
                self._printing_ids.add(order['id'])
                self._ctrl.print_worker.enqueue(order)
            self._refresh_cards(force=True)

    def _preview(self, order: dict):
        """Open PDF in system default viewer."""
        log_click('PREVIEW_BTN', f"Order #{order.get('orderNumber')}")
        try:
            ctrl = self._ctrl
            ctrl.log(f'Downloading preview for #{order["orderNumber"]}…')

            def _download():
                try:
                    pdf_bytes = ctrl.api.download_pdf(order['id'])
                    save_dir  = Path(ctrl.settings.save_folder)
                    save_dir.mkdir(parents=True, exist_ok=True)
                    pdf_path  = save_dir / f'{order["orderNumber"]}.pdf'
                    pdf_path.write_bytes(pdf_bytes)
                    ctrl.log(f'Opening preview: {pdf_path.name}')
                    os.startfile(str(pdf_path))
                except Exception as e:
                    ctrl.log(f'Preview failed: {e}', 'ERROR')

            threading.Thread(target=_download, daemon=True).start()
        except Exception:
            pass

    def _show_details_modal(self, order: dict):
        """Open the interactive order details pop-up modal."""
        log_click('DETAILS_MODAL_BTN', f"Order #{order.get('orderNumber')}")
        JobDetailsModal(self.winfo_toplevel(), order, self._ctrl)
