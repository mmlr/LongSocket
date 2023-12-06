#!/usr/bin/env python3

import codecs
import http.server
import json
import logging
import mimetypes
import os
import random
import select
import socket
import socketserver
import sys
import threading
import time


class Proxy(object):
	def __init__(self, address):
		self.address = address
		self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
		self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

		logging.info(f'connecting to {address}')
		self.waiting = False
		self.closed = False
		self.used()

	def connect(self):
		try:
			self.socket.connect(self.address)
			return True
		except Exception:
			return False

	def close(self):
		self.closed = True
		self.socket.close()

	def send(self, read, length):
		while length > 0:
			copy = min(length, 4096)
			data = read.read(copy)
			try:
				self.socket.send(data)
			except BrokenPipeError:
				return False

			length -= copy

		return True

	def receive(self, into):
		first = True
		while True:
			if self.closed:
				return False

			ready, _, error = select.select([self.socket], [], [self.socket], 0)
			if error:
				return False

			if not ready and not first:
				return True

			try:
				self.waiting = first
				data = self.socket.recv(4096)
			finally:
				self.waiting = False

			if not data:
				return not first

			into.write(data)
			first = False

	def used(self):
		self.lastUsed = time.time()

	def prune(self):
		return not self.waiting and time.time() - self.lastUsed > 10

	def __str__(self):
		return f'proxy to {self.address}'


class Handler(http.server.BaseHTTPRequestHandler):
	def sendResponse(self, mimeType='text/plain'):
		self.send_response(200)
		self.send_header('Access-Control-Allow-Origin', '*')
		self.send_header('Content-Type', mimeType)
		self.end_headers()

	def sendError(self, code):
		self.send_response(code)
		self.end_headers()

	def do_GET(self):
		result = None
		mimetype = None

		_, path = self.path.split('/', 1)
		path = os.path.normpath(os.path.join('web', path))
		if not path.startswith('web/'):
			logging.error(f'disallowed: {path}')
			self.sendError(403)
			return

		if not os.path.exists(path):
			self.sendError(404)
			return

		mimetype, encoding = mimetypes.guess_type(path)
		if mimetype is None:
			mimetype = 'application/octet-stream'

		self.sendResponse(mimetype)

		with open(path, 'rb') as inputFile:
			while True:
				data = inputFile.read(1024 * 1024)
				if not data:
					break

				self.wfile.write(data)


	def do_POST(self):
		if self.path.startswith('/open'):
			_, _, host, port = self.path.split('/')
			proxy = Proxy((host, int(port)))
			if not proxy.connect():
				self.sendError(404)
				return

			key = self.server.register(proxy)

			self.sendResponse('application/json')
			self.wfile.write(json.dumps({ 'key': key }).encode())
			return

		_, _, key = self.path.split('/')
		proxy = self.server.find(key)
		if proxy is None:
			self.sendError(404)
			return

		proxy.used()

		if self.path.startswith('/close'):
			self.server.unregister(key)
			self.sendResponse()
			return

		if self.path.startswith('/send'):
			self.sendResponse()
			if not proxy.send(self.rfile, int(self.headers['Content-Length'])):
				self.server.unregister(key)
			return

		if self.path.startswith('/receive'):
			self.sendResponse('application/octet-stream')
			if not proxy.receive(self.wfile):
				self.server.unregister(key)
			return

		self.sendError(404)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
	def __init__(self):
		self.proxies = {}
		self.lock = threading.RLock()
		self.pruneThread = threading.Thread(target=self.pruneLoop, daemon=True)
		self.pruneThread.start()

		http.server.HTTPServer.__init__(self, ('0.0.0.0', 8915), Handler)

	def register(self, proxy):
		key = codecs.encode(random.randbytes(8), 'hex').decode()
		with self.lock:
			self.proxies[key] = proxy
			return key

	def unregister(self, key):
		with self.lock:
			proxy = self.proxies.get(key)
			if proxy is None:
				return

			proxy.close()
			del self.proxies[key]

	def find(self, key):
		with self.lock:
			return self.proxies.get(key)

	def pruneLoop(self):
		while True:
			toPrune = []
			with self.lock:
				for key, proxy in self.proxies.items():
					if proxy.prune():
						toPrune.append(key)

				for key in toPrune:
					logging.warning(f'pruning connection {key}: {proxy}')
					self.unregister(key)

			time.sleep(10)


logging.basicConfig(level=logging.DEBUG)
Server().serve_forever()
