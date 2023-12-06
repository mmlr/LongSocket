let rfb;


function disconnectNoVNC()
{
	if (!rfb)
		return;

	rfb.disconnect();
	rfb = undefined;
}


async function startNoVNC(host, port)
{
	let module = await import('./novnc/core/rfb.js');

	let container = document.querySelector('#vnc');

	disconnectNoVNC();

	let screen = container.querySelector('.screen');
	if (true) {
		let socket = new LongSocket('', host, port);
		rfb = new module.default(screen, socket);
	} else {
		WebSocket = LongSocket;
		rfb = new module.default(screen, `ws://${host}:${port}/`);
	}

	let name = container.querySelector('.name');
	let target = `${host}:${port}`;
	name.textContent = target;

	let status = container.querySelector('.status .text');
	let indicator = container.querySelector('.status .indicator');
	indicator.className = 'indicator closed';

	let current = rfb;
	let wrapper = (handler) => {
		return (event) => {
			if (rfb != current)
				return;

			handler(event);
		};
	};

	let disconnected = (error) => {
		if (document.fullscreen)
			document.exitFullscreen();

		status.textContent = error ? 'Error' : 'Disconnected';
		indicator.className = 'indicator error';
		name.textContent = '';
	};

	rfb.addEventListener('connect', wrapper((event) => {
			status.textContent = 'Connected';
			indicator.className = 'indicator connected';
		}));

	rfb.addEventListener('disconnect', wrapper((event) => {
			disconnected(!event.detail.clean);
		}));

	rfb.addEventListener('desktopname', wrapper((event) => {
			name.textContent = `${target} - ${event.detail.name}`;
		}));

	rfb.addEventListener('credentialsrequired', wrapper((event) => {
			let password = prompt('Password Required:');
			if (!password)
				return;

			rfb.sendCredentials({ password: password });
		}));

	container.querySelector('#ctrlAltDelete').onclick = () => {
		if (rfb)
			rfb.sendCtrlAltDel();
	};

	container.querySelector('#fullscreen').onclick = () => {
		if (!rfb)
			return;

		document.body.requestFullscreen();
		rfb.focus();
	};

	container.querySelector('#disconnect').onclick = () => {
		disconnectNoVNC();
		disconnected();
	};

	let scale = container.querySelector('#scale');
	scale.onchange = () => {
		rfb.scaleViewport = scale.checked;
	};

	scale.onchange();

	document.onfullscreenchange = () => {
		document.body.classList.toggle('fullscreen', document.fullscreen);
	};
}


function init()
{
	let host = document.querySelector('#host');
	let port = document.querySelector('#port');
	let connect = document.querySelector('#connect');
	connect.onclick = () => startNoVNC(host.value, parseInt(port.value));
}


window.onload = init;
