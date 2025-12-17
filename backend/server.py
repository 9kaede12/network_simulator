import asyncio
import json
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from vtp import handle_vtp_config_command, handle_vtp_show_command

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_event(ws: WebSocket, payload: Dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    await send_event(ws, {"event": "log", "message": "Connected to Network Sea backend"})
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await send_event(ws, {"event": "log", "message": f"Invalid payload: {data}"})
                continue

            command = msg.get("command", "").strip()
            origin = (msg.get("node") or "PC1").strip() or "PC1"
            device_id = origin or "default-device"
            if not command:
                await send_event(ws, {"event": "log", "message": "Empty command"})
                continue

            command_lower = command.lower()

            if command_lower.startswith("vtp ") or command_lower == "vtp pruning":
                response = handle_vtp_config_command(device_id, command)
                await send_event(ws, {"event": "log", "message": response, "origin": origin})
            elif command_lower.startswith("no vtp pruning"):
                response = handle_vtp_config_command(device_id, command)
                await send_event(ws, {"event": "log", "message": response, "origin": origin})
            elif command_lower.startswith("show vtp"):
                response = handle_vtp_show_command(device_id, command)
                await send_event(ws, {"event": "log", "message": response, "origin": origin})
            elif command_lower.startswith("ping"):
                parts = command.split()
                target = parts[1] if len(parts) > 1 else "R1"
                await send_event(
                    ws,
                    {
                        "event": "log",
                        "message": f"Pinging {target}...",
                        "origin": origin,
                    },
                )
                await asyncio.sleep(0.5)
                await send_event(
                    ws,
                    {
                        "event": "flow",
                        "from": origin,
                        "to": target,
                        "proto": "ICMP",
                    },
                )
                await asyncio.sleep(1.5)
                await send_event(
                    ws,
                    {
                        "event": "log",
                        "message": f"Reply received from {target} ✅",
                        "origin": origin,
                    },
                )
            else:
                await send_event(
                    ws,
                    {
                        "event": "log",
                        "message": f"Unknown command: {command}",
                        "origin": origin,
                    },
                )
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as exc:  # pragma: no cover - logging unexpected errors
        print(f"[WS] Error: {exc}")
