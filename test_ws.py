import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect('ws://localhost:8000/ws') as ws:
            print('Connected')
            await ws.send('{"type": "ping"}')
            res = await ws.recv()
            print('Received:', res)
    except Exception as e:
        print('Error:', e)

asyncio.run(test_ws())
