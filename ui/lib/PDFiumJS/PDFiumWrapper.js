/**
 * Wrapper for the transpiled PDFium library. See
 * https://github.com/coolwanglu/PDFium.js/ 
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class PDFiumWrapper {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!PDFiumWrapper.instance) PDFiumWrapper.instance = new PDFiumWrapper();
		return PDFiumWrapper.instance;
	}
	
	constructor() {
		this.loadedDocs = new Map();
	}
	
	/**
	 * Load a document. callback is called on completion.
	 */
	async getDocument(id, blob) {
		if (!id) {
			throw new Error('PDFium: You must provide an ID to any document');
		}

		if (!this.#isInitialized()) {
			throw new Error('PDFium: Worker not running');
		}
		
		var doc = this.loadedDocs.get(id);
		if (doc && doc.isLoaded()) {
			console.log("PDFium: Using buffered document for " + id);
			
			return Promise.resolve(doc);
		}
			
		doc = new PDFiumWrapperDocument(this, id);
		
		this.loadedDocs.set(id, doc)
		
		var that = this;
		
		return blob.arrayBuffer()
		.then(function(arraybuffer) {
			return new Promise(function(resolve/*, reject*/) {
				that.PDFiumWorker.postMessage({
					command: 'loadDocument',
					id: id,
					data: arraybuffer,
					timestamp: Date.now()
				}, [arraybuffer]);			
				
				function finish(wdoc) {
					resolve(wdoc);
				}
				
				doc.registerDocumentLoadCallback(finish);
			})
		});
	}
	
	/**
	 * Destroy all loaded documents
	 */
	destroyAll() {
		if (!this.#isInitialized()) {
			// No need to destroy anything
			return;
		}
			
		this.loadedDocs = new Map();
		
		this.PDFiumWorker.postMessage({
			command: 'destroyAll'
		});
		
	}

	/**
	 * Retrieves a document by ID. Used internally to retrieve docs in 
	 * incoming worker messages.
	 */	
	getLoadedDocument(id) {
		if (!this.#isInitialized()) {
			throw new Error('PDFium worker not running');
		}
		
		if (!id) {
			throw new Error('PDFium: You must provide an ID to any document');
		}
			
		var ret = this.loadedDocs.get(id);
		
		if (!ret) {
			throw new Error('Document ' + id + ' not registered');
		}
		
		return ret;
	}
	
	/**
	 * Returns if the web worker is running (not if the worker itself is initialized!)
	 */
	#isInitialized() {
		return !!this.PDFiumWorker;
	}
	
	/**
	 * Initialize the web worker if not yet done, and set up the message handler.
	 */
	async initWorker() {
		if (this.#isInitialized()) {
			//console.log("PDFium worker already running");
			return Promise.resolve();
		}
		
		/**
		 * PDFium worker setup.
		 */
		this.PDFiumWorker = new Worker("ui/lib/PDFiumJS/PDFiumWorker.js");
		var that = this;
		
		/**
		 * Receive worker messages
		 */
		return new Promise(function(resolve, reject) {
			that.PDFiumWorker.onmessage = function(e) {
				try {
					switch (e.data.command) {
						case 'consolemessage':
							console.log(e.data.message);
							break;
	
						case 'documentLoaded':
							// Document has been loaded
							try {
								var doc = that.getLoadedDocument(e.data.id);
								doc.finishDocument(e.data.pages);
								
								if (doc.callback) {
									doc.callback(doc);
									doc.callback = null;
								}
								
							} catch (err) {
								console.log(err);
							}
							break;
							
						case 'pageRendered':
							try {
								// Page has been rendered
								var doc = that.getLoadedDocument(e.data.id);			
								var page = doc.getPage(e.data.index);
								
								page.applyToCanvas(
									new ImageData( 
	  									new Uint8ClampedArray(e.data.pixels),
										e.data.width,
										e.data.height 
									)
								);
								
							} catch (err) {
								console.log(err);
							}
							break;
							
						case 'error':
							console.log("PDFium error: ");
							console.log(e.data);
							
							Notes.getInstance().showAlert('PDFium error: ' + (e.data.error.message ? e.data.error.message : ''), 'E');
							break;
							
						case 'ping':
							const loadTime = Date.now() - e.data.startTimestamp;
							
							console.log("PDFiumWrapper: Loaded worker in " + loadTime + "ms");
							
							resolve({
								loadTime: loadTime
							});
							break;
							
						default:
							throw new Error('Unknown or missing PDFiumWorker command: ' + e.data.command);
					}	
					
				} catch (err) {
					console.log("PDFium wrapper error: ");
					console.log(err);
					
					Notes.getInstance().showAlert('PDFium error: ' + (err.message ? err.message : ''), 'E');
				}
			}			

			that.PDFiumWorker.postMessage({
				command: 'ping',
				message: 'Init',
				startTimestamp: Date.now()
			})
		});
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Model class for Documents, calling the PDFium worker.
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class PDFiumWrapperDocument {
	
	constructor(wrapper, id, callback) {
		if (!id) {
			throw new Error('PDFium: You must provide an ID to any document');
		}
		
		this.wrapper = wrapper;
		this.id = id;
		this.callback = callback;
		this.pages = false;
		
		this.startTime = Date.now();
	}
	
	/**
	 * Is the document loaded?
	 */
	isLoaded() {
		return !!this.pages;
	}
	
	/**
	 * Load the document (set pages).
	 */
	finishDocument(info) {
		this.pages = [];
		for (var p=0; p<info.length; ++p) {
			this.pages.push(new PDFiumWrapperPage(this, info[p]));
		}
		
		const endTime = Date.now();
		const loadTime = endTime - this.startTime;
		
		console.log('PDFiumWrapper: Loaded document in ' + loadTime + 'ms (' + this.id + ')');
		
		if (this.documentLoadCallback) {
			this.documentLoadCallback(this);
			this.documentLoadCallback = null;
		}
			
	}
	
	/**
	 * Register a callback after finishing a document.
	 */
	registerDocumentLoadCallback(cb) {
		this.documentLoadCallback = cb;
	}
	
	/**
	 * Unload the document.
	 */
	destroy() {
		if (!this.isLoaded()) {
			throw new Error("Document not loaded");
		}
		
		this.wrapper.PDFiumWorker.postMessage({
			command: 'destroyDocument',
			id: this.id
		});
		
		this.pages = false;
	}
	
	/**
	 * Returns a page wrapper instance.
	 */
	getPage(index) {
		if (!this.isLoaded()) {
			throw new Error("Document not loaded");
		}

		if ((index < 0) || (index >= this.pages.length)) {
			throw new Error("Invalid page number: " + index);
		}
		
		return this.pages[index];
	}
	
	/**
	 * Number of pages.
	 */
	get numPages() {
		if (!this.isLoaded()) {
			throw new Error("Document not loaded");
		}

		return this.pages.length;
	}
}
	
/**
 * Model class for document pages, calling the PDFium worker.
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class PDFiumWrapperPage {
	
	constructor(main, info) {
		this.main = main;
		this.index = info.index;
		this.dimensions = info.dimensions;
		
		this.canvas = null;
	}
	
	/**
	 * Renders the page to the passed DOM canvas.
	 *
	 * The canvas dimensions will be set to the PDFs page size if w/h are not supported, 
	 * but you can also determine yourself what the size should be.
	 */
	async render(canvas, width, height) {
		if (this.pageRenderedCallback) {
			throw new Error("Page " + this.index + " is already rendering");
		}
		
		this.startTime = Date.now();
		
		if (!this.main.isLoaded()) {
			throw new Error("Document not loaded");
		}
		
		if (this.canvas) {
			throw new Error('Page ' + this.index + ' is still rendering');
		}
		
		this.canvas = canvas;
		
		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';
		
		this.canvas.width = width * window.devicePixelRatio;
		this.canvas.height = height * window.devicePixelRatio;
		
		var that = this;
		return new Promise(function(resolve/*, reject*/) {
			that.main.wrapper.PDFiumWorker.postMessage({
				command: 'renderPage',
				id: that.main.id,
				index: that.index,
				width: width,
				height: height,
				devicePixelRatio: window.devicePixelRatio
			});
			
			that.pageRenderedCallback = function(page) {
				resolve(page);
			}
		})
	}
	
	/**
	 * Get page dimensions.
	 */
	getDimensions() {
		if (!this.main.isLoaded()) {
			throw new Error("Document not loaded");
		}

		return this.dimensions;
	}
	
	/**
	 * Internal: Apply the received image data to the buffered canvas (see render()).
	 */
	applyToCanvas(image) {
		if (!this.main.isLoaded()) {
			throw new Error("Document not loaded");
		}

		var ctx = this.canvas.getContext("2d");
		ctx.putImageData(image, 0, 0);
		
		this.canvas = null;
		
		const endTime = Date.now();
		const loadTime = endTime - this.startTime;
		
		console.log('PDFiumWrapper: Rendered page ' + this.index + ' in ' + loadTime + 'ms (' + this.main.id + ')');

		if (this.pageRenderedCallback) {
			this.pageRenderedCallback(this);
			this.pageRenderedCallback = null;
		}
	}
}

