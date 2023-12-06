function LongSocket(base, host, port)
{
	let converted = '';
	try {
		let url = new URL(base);
		if (url.protocol == 'ws:' || url.protocol == 'wss:') {
			converted = ` converted from '${base}'`;
			base = url.pathname.replace(/^\//, '');
			host = url.hostname;
			port = parseInt(url.port || (url.protocol == 'ws:' ? 80 : 443));
		}
	} catch (error) {
	}

	console.log(`using LongSocket('${base}', '${host}', ${port})${converted}`);

	this.readyState = this.CONNECTING;
	this.base = base;

	let read = () => {
		if (this.readyState != this.OPEN)
			return;

		fetch(`${base}receive/${this.key}`, {
				method: 'POST',
				cache: 'no-store'
			}).then((response) => {
				if (!response.ok)
					throw new Error(`request failed ${response.code}`);

				if (this.binaryType == 'arraybuffer')
					return response.arrayBuffer();
				else if (this.binaryType == 'blob')
					return response.blob();
			})
			.then((data) => this.onmessage({ data }))
			.then(read, (error) => {
					this.close();
					this.onerror({ error });
				});
	};

	fetch(`${base}open/${host}/${port}`, {
			method: 'POST',
			cache: 'no-store'
		}).then((response) => response.json()).then((data) => {
			this.readyState = this.OPEN;
			this.key = data.key;
			this.onopen();
		}).then(read, (error) => {
			this.readyState = this.CLOSED;
			this.onerror({ error });
		});
}


LongSocket.prototype.send = function(data)
{
	fetch(`${this.base}send/${this.key}`, {
			method: 'POST',
			cache: 'no-store',
			body: data
		}).catch((error) => this.onerror({ error }));
}


LongSocket.prototype.close = function()
{
	this.readyState = this.CLOSING;
	fetch(`${this.base}close/${this.key}`, {
			method: 'POST',
			cache: 'no-store'
		}).catch(() => {}).then(() => this.readyState = this.CLOSED);
}


LongSocket.prototype.CONNECTING = 0;
LongSocket.prototype.OPEN = 1;
LongSocket.prototype.CLOSING = 2;
LongSocket.prototype.CLOSED = 3;

LongSocket.prototype.onopen = () => {};
LongSocket.prototype.onmessage = () => {};
LongSocket.prototype.onerror = () => {};
LongSocket.prototype.binaryType = 'blob';
LongSocket.prototype.protocol = '';
LongSocket.prototype.readyState = -1;

Object.assign(LongSocket, LongSocket.prototype);
