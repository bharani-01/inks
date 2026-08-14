"""
API endpoint constants.
"""


class Endpoints:
    AUTH_LOGIN   = '/api/auth/login'
    AUTH_ME      = '/api/auth/me'

    AGENT_PENDING     = '/api/agent/pending'
    AGENT_HEARTBEAT   = '/api/agent/heartbeat'
    AGENT_LOG         = '/api/agent/log'
    AGENT_DISCONNECT  = '/api/agent/disconnect'
    AGENT_CMD_ACK     = '/api/agent/command/{id}/ack'   # format with id

    ORDER_PRINT_READY = '/api/orders/admin/{id}/print-ready'
    ORDER_STATUS      = '/api/orders/admin/{id}/status'
