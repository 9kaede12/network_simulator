#!/bin/bash

# UvicornでFastAPIサーバーを起動
uvicorn backend.server:app --host 0.0.0.0 --port $PORT