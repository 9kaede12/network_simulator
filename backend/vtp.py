from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class VTPDeviceState:
    device_id: str
    mode: str = "server"  # server | client | transparent | off
    domain: str = ""
    password: Optional[str] = None
    revision: int = 0
    pruning_enabled: bool = False
    vlan_database: Dict[int, Dict[str, Any]] = field(default_factory=dict)

    def to_status_text(self) -> str:
        domain_display = self.domain if self.domain else "not configured"
        pruning_display = "Enabled" if self.pruning_enabled else "Disabled"
        return "\n".join(
            [
                "VTP Version: 2",
                f"Configuration Revision: {self.revision}",
                "Maximum VLANs supported locally: 1005",
                f"Number of existing VLANs: {len(self.vlan_database)}",
                f"VTP Operating Mode: {self.mode}",
                f"VTP Domain Name: {domain_display}",
                f"VTP Pruning Mode: {pruning_display}",
            ]
        )

    def password_status_text(self) -> str:
        if self.password:
            return "VTP Password: <not displayed> (configured)"
        return "VTP Password: not configured"


class VTPDomainRegistry:
    global_domains: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_domain(cls, domain_name: str) -> Optional[Dict[str, Any]]:
        if not domain_name:
            return None
        return cls.global_domains.get(domain_name)

    @classmethod
    def update_domain_from_device(cls, device_state: VTPDeviceState) -> None:
        if device_state.mode != "server" or not device_state.domain:
            return
        cls.global_domains[device_state.domain] = {
            "revision": device_state.revision,
            "vlans": {vid: vlan.copy() for vid, vlan in device_state.vlan_database.items()},
        }

    @classmethod
    def sync_device_from_domain(cls, device_state: VTPDeviceState) -> None:
        if not device_state.domain or device_state.mode != "client":
            return
        domain_state = cls.get_domain(device_state.domain)
        if not domain_state:
            return
        device_state.revision = domain_state.get("revision", 0)
        device_state.vlan_database = {
            vid: vlan.copy() for vid, vlan in domain_state.get("vlans", {}).items()
        }


global_device_states: Dict[str, VTPDeviceState] = {}


def get_device_state(device_id: str) -> VTPDeviceState:
    if device_id not in global_device_states:
        global_device_states[device_id] = VTPDeviceState(device_id=device_id)
    return global_device_states[device_id]


def _set_mode(device: VTPDeviceState, mode: str) -> str:
    allowed_modes = {"server", "client", "transparent", "off"}
    if mode not in allowed_modes:
        return f"Invalid VTP mode: {mode}"
    device.mode = mode
    if mode == "server" and device.domain:
        VTPDomainRegistry.update_domain_from_device(device)
    elif mode == "client":
        VTPDomainRegistry.sync_device_from_domain(device)
    return f"VTP mode set to {mode}"


def _set_domain(device: VTPDeviceState, domain: str) -> str:
    changed = device.domain != domain
    device.domain = domain
    if changed:
        device.revision = 0
    if device.mode == "server" and domain:
        VTPDomainRegistry.update_domain_from_device(device)
    elif device.mode == "client" and domain:
        VTPDomainRegistry.sync_device_from_domain(device)
    suffix = " (changed)" if changed else ""
    return f"VTP domain name set to {domain or 'not configured'}{suffix}"


def _set_password(device: VTPDeviceState, password: str) -> str:
    device.password = password
    return "VTP password configured"


def handle_vtp_config_command(device_id: str, command: str) -> str:
    device = get_device_state(device_id)
    normalized = command.strip()
    tokens = normalized.split()
    if not tokens:
        return "Invalid VTP command"

    if normalized.lower().startswith("no vtp pruning"):
        device.pruning_enabled = False
        return "VTP pruning disabled"

    if tokens[0].lower() != "vtp":
        return "Invalid VTP command"

    if len(tokens) < 2:
        return "Incomplete VTP command"

    subcommand = tokens[1].lower()
    if subcommand == "mode" and len(tokens) >= 3:
        return _set_mode(device, tokens[2].lower())
    if subcommand == "domain" and len(tokens) >= 3:
        return _set_domain(device, tokens[2])
    if subcommand == "password" and len(tokens) >= 3:
        password = " ".join(tokens[2:])
        return _set_password(device, password)
    if subcommand == "pruning":
        device.pruning_enabled = True
        return "VTP pruning enabled"

    return "Unsupported VTP command"


def handle_vtp_show_command(device_id: str, command: str) -> str:
    device = get_device_state(device_id)
    normalized = command.strip().lower()

    if normalized.startswith("show vtp status"):
        VTPDomainRegistry.sync_device_from_domain(device)
        return device.to_status_text()
    if normalized.startswith("show vtp password"):
        return device.password_status_text()

    return "Unsupported VTP show command"
