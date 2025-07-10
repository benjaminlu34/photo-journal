import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';

interface DocWithClients extends Y.Doc {
  clients: Set<WebSocket>;
}

const docs = new Map<string, DocWithClients>();

function getDoc(name: string): DocWithClients {
  let doc = docs.get(name);
  if (!doc) {
    doc = new Y.Doc() as DocWithClients;
    doc.clients = new Set();
    docs.set(name, doc);
  }
  return doc;
}

export function attachCollaboration(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (!url.pathname?.startsWith('/collab/')) return;
    wss.handleUpgrade(req, socket, head, ws => {
      const space = url.pathname!.slice('/collab/'.length);
      const doc = getDoc(space);
      doc.clients.add(ws);
      ws.send(Y.encodeStateAsUpdate(doc));

      ws.on('message', msg => {
        const update = new Uint8Array(msg as Buffer);
        Y.applyUpdate(doc, update);
        doc.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(update);
          }
        });
      });

      ws.on('close', () => {
        doc.clients.delete(ws);
      });
    });
  });
}
