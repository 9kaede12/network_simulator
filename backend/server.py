import asyncio
import json
import os
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .vtp import handle_vtp_config_command, handle_vtp_show_command

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では具体的なURLに変更推奨
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_event(ws: WebSocket, payload: Dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload))


# ⚠️ 重要: WebSocketエンドポイントを静的ファイル配信より先に定義
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


# 静的ファイル配信（フロントエンド用）
# ⚠️ 重要: WebSocketエンドポイントの後に配置
if os.path.exists("dist"):
    # assetsフォルダが存在する場合のみマウント
    if os.path.exists("dist/assets"):
        app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
    
    # ルートパスとその他すべてのパスでフロントエンドを配信
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # 空のパス（ルート）の場合はindex.htmlを返す
        if not full_path:
            return FileResponse("dist/index.html")
        
        # 指定されたファイルが存在する場合はそれを返す
        file_path = f"dist/{full_path}"
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # それ以外の場合はindex.htmlを返す（SPAルーティング用）
        return FileResponse("dist/index.html")
else:
    print("⚠️ Warning: dist directory not found. Frontend will not be served.")
    
    # デバッグ用：distフォルダが存在しない場合のルートエンドポイント
    @app.get("/")
    async def root():
        return {
            "status": "Backend is running",
            "message": "Frontend not found. Please build the frontend first.",
            "websocket": "/ws"
        }