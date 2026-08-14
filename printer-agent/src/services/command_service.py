"""
Command Service
===============
Executes remote commands received via heartbeat.
"""
import json
import queue


class CommandService:
    """
    Processes remote commands sent by admins via the Printa dashboard.
    Dispatches them as UI events via the event queue.
    """

    def __init__(self, api_client, event_queue: queue.Queue):
        self._api = api_client
        self._queue = event_queue

    def process(self, commands: list[dict]):
        """Process a list of commands received from heartbeat."""
        for cmd in commands:
            cmd_id   = cmd.get('id')
            cmd_type = cmd.get('commandType', '')
            payload  = {}
            if cmd.get('payload'):
                try:
                    payload = json.loads(cmd['payload'])
                except Exception:
                    payload = {}

            # Dispatch command as a UI event
            self._queue.put({
                'type': 'REMOTE_CMD',
                'cmd': cmd_type,
                'payload': payload,
                'id': cmd_id,
            })

            # Acknowledge the command
            if cmd_id:
                self._api.ack_command(cmd_id)
