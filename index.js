import { render, html, svg } from './uhtml.js';

const hexToRGBA = hex => {
	let [r, g, b, a = 255] = hex
		.match(/\w\w/g)
		.map(x => parseInt(x, 16));
	return [r, g, b, a]
}

const state = {
	canvas: null,
	gridColors: [],
	tempGridColors: [],
	gridSize: [64, 64],
	canvasSize: [500, 500],
	maxCanvasSize: 500,
	selected: [],
	tool: "draw",
	color: hexToRGBA("#000000"),
	mousedown: false,
	mousedownPt: [0, 0],
	currentPt: [0, 0],
	showGrid: false,
	defaultGridArraySize: [64, 64],
	// hoveredCell: null,
}

const view = state => html`
	<div class="canvas-container">
		<canvas class="drawing-canvas"></canvas>
	</div>
	<div class="toolbox">
		<button @click=${() => state.tool = "draw"}>draw</button>
		<button @click=${() => state.tool = "circle"}>circle</button>
		<button @click=${() => state.tool = "rectangle"}>rectangle</button>
		<button @click=${() => state.tool = "line"}>line</button>
		<button @click=${() => state.tool = "bucket"}>bucket</button>
		<button @click=${() => state.tool = "select"}>select</button>
		<button @click=${() => state.tool = "copy"}>TODO copy</button>
		<button @click=${() => state.tool = "paste"}>TODO paste</button>
		<button @click=${() => state.tool = "move"}>TODO move</button>
		<button @click=${() => {}}>TODO export</button>
		<div>
			<span>x:</span>
			<input 
				class="gridsize" 
				type="number" 
				min="1"
				max="128"
				.value=${state.gridSize[0]}
				@input=${e => { 
					state.gridSize[0] = Math.min(Math.max(Number(e.target.value), 1), state.defaultGridArraySize[0]);
					setCanvasSize(state.canvas);
				}}/>
			<span>y:</span>
			<input 
				class="gridsize" 
				type="number" 
				min="1"
				max="128"
				.value=${state.gridSize[1]}
				@input=${e => { 
					state.gridSize[1] = Math.min(Math.max(Number(e.target.value), 1), state.defaultGridArraySize[1]);
					setCanvasSize(state.canvas);
				}}/>
		</div>

		<div class="view-window">
			<canvas width="100" height="100" class="preview-canvas"></canvas>
		</div>
	</div>

	<div class="colors">
		<button>+ add color</button>
		<input 
			type="color" 
			.value=${state.color} 
			@input=${e => state.color = hexToRGBA(e.target.value)}
			@click=${e => state.color = hexToRGBA(e.target.value)}/>
		<button @click=${() => state.color = hexToRGBA("#00000000")}>clear</button>
	</div>
`

const r = () => {
	render(document.body, view(state));
}

const readCanvas = canvas => {
	const w = parseInt(canvas.style.width);
	const h = parseInt(canvas.style.height);
	const ctx = canvas.getContext("2d");

	return [w, h, ctx]
}

const fillGrid = (canvas, colors) => {
	const [ w, h, ctx ] = readCanvas(canvas);
	const [ gridW, gridH ] = state.gridSize;
	const xSize = w/gridW;
	const ySize = h/gridH;
	
	colors.forEach((color, i) => {
		if (color === null) return;
	    const x = i%state.defaultGridArraySize[0];
	    const y = Math.floor(i/state.defaultGridArraySize[1]);
	    ctx.fillStyle = color;
	    ctx.fillRect(x*xSize-0.5, y*ySize-0.5, xSize+0.5, ySize+0.5);
	})
}

const gridBackground = (canvas) => {
	const [ w, h, ctx ] = readCanvas(canvas);
	const [ gridW, gridH ] = state.gridSize;
	const xSize = w/gridW;
	const ySize = h/gridH;

	for (let i = 0; i < gridW * gridH; i++) {
		const x = i%gridW;
	    const y = Math.floor(i/gridW);
		ctx.fillStyle = (x%2 === 0 && y%2 === 1) || (x%2 === 1 && y%2 === 0) ? "#b4e2fc87" : "#e3e3e34a";
	    ctx.fillRect(x*xSize, y*ySize, xSize, ySize);
	}
}

function line(from, to) {
	const points = [];
	if (Math.abs(from[0] - to[0]) > Math.abs(from[1] - to[1])) {
		if (from[0] > to[0]) [from, to] = [to, from];
		let slope = (to[1] - from[1]) / (to[0] - from[0]);
		for (let [x, y] = from; x <= to[0]; x++) {
			points.push([ x, Math.round(y) ]);
			y += slope;
		}
	} else {
		if (from[1] > to[1]) [from, to] = [to, from];
		let slope = (to[0] - from[0]) / (to[1] - from[1]);
		for (let [x, y] = from; y <= to[1]; y++) {
			points.push([ Math.round(x), y ]);
			x += slope;
		}
	}
	return points;
}

const drawGrid = (canvas) => {
	if (!state.showGrid) return;
	const [ w, h, ctx ] = readCanvas(canvas);
	const [ gridW, gridH ] = state.gridSize;
	const xSize = w/gridW;
	const ySize = h/gridH;

	for (let i = 0; i < gridW; i++) {
	    const x = i*xSize;
	    if (x === 0) continue;
	    ctx.strokeStyle = `black`;
	    ctx.lineWidth = xSize/20;
	    ctx.beginPath();
	    ctx.moveTo(x, 0);
	    ctx.lineTo(x, h);
	    ctx.stroke();
	}

	for (let i = 0; i < gridH; i++) {
	    const y = i*ySize;
	    if (y === 0) continue;
	   	ctx.strokeStyle = `black`;
	   	ctx.lineWidth = xSize/20;
	    ctx.beginPath();
	    ctx.moveTo(0, y);
	    ctx.lineTo(w, y);
	    ctx.stroke();
	}
}

const tools_mousedown = {
	"draw": (x, y) => {
		const [ gridW, gridH ] = state.defaultGridArraySize;
		state.gridColors[gridW*y+x] = state.color;
	},
	"bucket": (x, y) => {
		const [ gridW, gridH ] = state.defaultGridArraySize;

		const startColor = state.gridColors[gridW*y+x];
		const newColor = state.color;
		const grid = state.gridColors;

		const checkValidity = (x, y) => {
			return (x >= 0 && y >= 0 && x < gridW && y < gridH) && grid[gridW*y+x] === startColor && startColor !== newColor;
		}

		// const floodFill = (startColor, newColor, x, y, grid) => {
		// 	if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;

 	// 		if (grid[gridW*y+x] === startColor && startColor !== newColor) {
		// 		grid[gridW*y+x] = newColor;
		// 		floodFill(startColor, newColor, x+1, y, grid);
		// 		floodFill(startColor, newColor, x-1, y, grid);
		// 		floodFill(startColor, newColor, x, y+1, grid);
		// 		floodFill(startColor, newColor, x, y-1, grid);
		// 	}
			
		// }

		const q = [];
		q.push([x, y]);
		while (q.length > 0) {
			const [ x1, y1 ] = q.pop();
			grid[gridW*y1+x1] = newColor;
			if (checkValidity(x1+1,y1)) q.push([ x1+1, y1 ])
			if (checkValidity(x1-1,y1)) q.push([ x1-1, y1 ])
			if (checkValidity(x1,y1+1)) q.push([ x1, y1+1 ])
			if (checkValidity(x1,y1-1)) q.push([ x1, y1-1 ])
		}

		// floodFill(state.gridColors[gridW*y+x], state.color, x, y, state.gridColors)
	},
	"select": (x, y) => {
		const [ gridW, gridH ] = state.defaultGridArraySize;
		const grid = state.gridColors;

		const seen = [];

		const checkValidity = (x, y) => {
			const color = grid[gridW*y+x];
			return (x >= 0 && y >= 0 && x < gridW && y < gridH) && color !== "#00000000" && !seen.includes(y*gridW+x);
		}

		const q = [];

		const add = (x, y) => {
			q.push([x, y]);
			seen.push(y*gridW+x);
		}

		q.push([x, y]);
		while (q.length > 0) {
			const [ x1, y1 ] = q.pop();
			if (checkValidity(x1+1,y1)) add(x1+1, y1);
			if (checkValidity(x1+1,y1+1)) add(x1+1, y1+1);
			if (checkValidity(x1-1,y1)) add(x1-1, y1);
			if (checkValidity(x1-1,y1-1)) add(x1-1,y1-1);
			if (checkValidity(x1,y1+1)) add(x1, y1+1);
			if (checkValidity(x1-1,y1+1)) add(x1-1,y1+1);
			if (checkValidity(x1,y1-1)) add(x1, y1-1);
			if (checkValidity(x1+1,y1-1)) add(x1+1,y1-1);
		}

		state.selected = seen;
	},
}

const tools_mousemove = {
	"draw": (x, y) => {
		if (!state.mousedown) return;
		const [ gridW, gridH ] = state.defaultGridArraySize;

		const pts = line(state.currentPt, state.mousedownPt);

		pts.forEach(([ x, y ]) => {
			state.tempGridColors[gridW*y+x] = state.color;
		})

		state.mousedownPt = state.currentPt;
	},
	"rectangle": (x, y) => {
		state.tempGridColors = state.tempGridColors.fill(null);
		if (!state.mousedown) return;
		// const [ gridW, gridH ] = state.gridSize;
		const [ gridW, gridH ] = state.defaultGridArraySize;

		const xMin = Math.min(state.currentPt[0], state.mousedownPt[0]);
		const xMax = Math.max(state.currentPt[0], state.mousedownPt[0]);
		const yMin = Math.min(state.currentPt[1], state.mousedownPt[1]);
		const yMax = Math.max(state.currentPt[1], state.mousedownPt[1]);
		for (let x = xMin; x <= xMax; x++) {
			for (let y = yMin; y <= yMax; y++) {
				state.tempGridColors[gridW*y+x] = state.color;
			}
		}
	},
	"line": (x, y) => {
		state.tempGridColors = state.tempGridColors.fill(null);
		if (!state.mousedown) return;

		const [ gridW, gridH ] = state.defaultGridArraySize;

		const pts = line(state.currentPt, state.mousedownPt);

		pts.forEach(([ x, y ]) => {
			state.tempGridColors[gridW*y+x] = state.color;
		})
	},
	"circle": (x, y) => {
		state.tempGridColors = state.tempGridColors.fill(null);
		if (!state.mousedown) return;

		const [ gridW, gridH ] = state.defaultGridArraySize;

		const xMin = Math.min(state.currentPt[0], state.mousedownPt[0]);
		const xMax = Math.max(state.currentPt[0], state.mousedownPt[0]);
		const yMin = Math.min(state.currentPt[1], state.mousedownPt[1]);
		const yMax = Math.max(state.currentPt[1], state.mousedownPt[1]);
		const horizAxisR = (xMax - xMin)/2
		const vertAxisR = (yMax - yMin)/2
		const center = [xMin+horizAxisR, yMin+vertAxisR]
		const inCircle = (x,y) => ( (Math.pow(x-center[0],2)/Math.pow(horizAxisR,2)) + (Math.pow(y-center[1],2)/Math.pow(vertAxisR,2)) ) < 1

		for (let x = xMin; x <= xMax; x++) {
			for (let y = yMin; y <= yMax; y++) {
				if (inCircle(x,y)) {
					state.tempGridColors[gridW*y+x] = state.color;
				}
			}
		}
	}
}

const BACKGROUND_BLUE = hexToRGBA("#b4e2fc87");
const BACKGROUND_WHITE = hexToRGBA("#e3e3e34a");
const drawCanvas = (canvas, main = true) => {
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const grid = state.tempGridColors.map((color, i) => {
		if (color === null) return state.gridColors[i];
		else return color; 
	})

	// gridBackground(canvas);
	// fillGrid(canvas, grid);
	// drawGrid(canvas);

	const [ w, h ] = readCanvas(canvas);
	const [ gridW, gridH ] = main ? state.gridSize : state.defaultGridArraySize;
	const xSize = w/gridW;
	const ySize = h/gridH;

	const pixels = new Uint8ClampedArray(
		grid
			.map((color, i) => {
				if (color[3] < 255) {
					const x = i%state.defaultGridArraySize[0];
					const y = Math.floor(i/state.defaultGridArraySize[1]);
					color = (x%2 === 0 && y%2 === 1) || (x%2 === 1 && y%2 === 0)
						? BACKGROUND_BLUE
						: BACKGROUND_WHITE;
				}
				return color
			})
			.flat()
	);
	// ctx.putImageData(new ImageData(pixels, gridW, gridH), 0, 0, 0, 0, w, h);
	ctx.putImageData(new ImageData(pixels, gridW, gridH), 0, 0);
	// grid.forEach((color, i) => {
	// 	const x = i%state.defaultGridArraySize[0];
	//     const y = Math.floor(i/state.defaultGridArraySize[1]);

	//     ctx.fillStyle = (x%2 === 0 && y%2 === 1) || (x%2 === 1 && y%2 === 0) ? "#b4e2fc87" : "#e3e3e34a";
	//     ctx.fillRect(x*xSize, y*ySize, xSize, ySize);
	// 	
	// 	ctx.fillStyle = color;
	//     ctx.fillRect(x*xSize-0.5, y*ySize-0.5, xSize+0.5, ySize+0.5);
	// })

	state.selected.forEach(i => {
		const x = i%state.defaultGridArraySize[0];
	    const y = Math.floor(i/state.defaultGridArraySize[1]);
		ctx.fillStyle = "#aaaaaaaa";
		ctx.fillRect(x*xSize-0.5, y*ySize-0.5, xSize+0.5, ySize+0.5);
	})
}

const setCanvasSize = c => {
	if (state.gridSize[0] < state.gridSize[1]) {
		state.canvasSize[0] = state.gridSize[0]/state.gridSize[1]*state.maxCanvasSize;
		state.canvasSize[1] = state.maxCanvasSize;
	} else {
		state.canvasSize[0] = state.maxCanvasSize;
		state.canvasSize[1] = state.gridSize[1]/state.gridSize[0]*state.maxCanvasSize;
	}

	c.width = state.gridSize[0];
	c.height = state.gridSize[1];
	c.style.width = state.canvasSize[0] + 'px';
	c.style.height = state.canvasSize[1] + 'px';
	const ctx = c.getContext("2d");
	ctx.translate(0.5, 0.5);
}

function getPoint(e) {
	const c = document.querySelector(".drawing-canvas");
	const rect = c.getBoundingClientRect();
  	const rawX = e.clientX - rect.left;
  	const rawY = e.clientY - rect.top;

  	const [ w, h, ctx ] = readCanvas(c);
	const [ gridW, gridH ] = state.gridSize;
	const xSize = w/gridW;
	const ySize = h/gridH;

  	const x = Math.floor(rawX/xSize);
  	const y = Math.floor(rawY/ySize);

  	return [ x, y ];
}

const init = state => {
	render(document.body, view(state));
	const c = document.querySelector(".drawing-canvas");
	state.canvas = c;

	setCanvasSize(c);
	// init canvas data
	const [ gridW, gridH ] = state.gridSize;
	state.gridColors = new Array(state.defaultGridArraySize[0] * state.defaultGridArraySize[1]).fill(hexToRGBA("#00000000"));
	state.tempGridColors = new Array(state.defaultGridArraySize[0] * state.defaultGridArraySize[1]).fill(null);

	animate();

	c.addEventListener("mousedown", (e) => {
	  	state.mousedown = true;
	  	const pt = getPoint(e);
	  	state.mousedownPt = pt;
	  	if (state.tool in tools_mousedown) tools_mousedown[state.tool](...pt);
	})

	c.addEventListener("mousemove", (e) => {
		const pt = getPoint(e);
	  	state.currentPt = pt;
	  	if (state.tool in tools_mousemove) tools_mousemove[state.tool](...pt);
	})

	c.addEventListener("mouseup", (e) => {
		state.mousedown = false;
		state.mousedownPt = [0, 0];
		state.currentPt = [0, 0];

		state.tempGridColors.forEach((c, i) => {
			if (c !== null) state.gridColors[i] = c;
		})

		state.tempGridColors.fill(null);
	})

	c.addEventListener("mouseleave", (e) => {
		state.mousedown = false;
		state.mousedownPt = [0, 0];
		state.currentPt = [0, 0];

		state.tempGridColors.forEach((c, i) => {
			if (c !== null) state.gridColors[i] = c;
		})

		state.tempGridColors.fill(null);
	})
}

const animate = () => {
	drawCanvas(state.canvas);
	drawCanvas(document.querySelector(".preview-canvas"), false);
	window.requestAnimationFrame(animate);
}

init(state);




