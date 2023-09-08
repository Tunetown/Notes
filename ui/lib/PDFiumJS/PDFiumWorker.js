/**
 * Web Worker for PDFium.
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
const showDebugMessages = true;

/**
 * Pre-set emscripten module
 */  
self.Module = {
	TOTAL_MEMORY: 1024 * 1024 * 256,
	noExitRuntime: true,
	
	print: function(msg) { 
		if (showDebugMessages) {
			self.postMessage({
				command: 'consolemessage',
				message: 'PDFium Worker: ' + msg
			})
		} 
	},
	
	printErr: function(msg) { 
		self.postMessage({
			command: 'consolemessage',
			message: 'PDFium Worker: ' + msg			
		})
	},
	
	_main: function () {
		if (typeof PDFiumJS === 'undefined') {
			self.PDFiumJS = {};
		}
		
		self.PDFiumJS.C = {
			init: cwrap('PDFiumJS_init', null, []),
			Doc_new: cwrap('PDFiumJS_Doc_new', 'number', ['number', 'number']),
			Doc_delete: cwrap('PDFiumJS_Doc_delete', null, ['number']),
			Doc_get_page_count: cwrap('PDFiumJS_Doc_get_page_count', 'number', ['number']),
			Doc_get_page: cwrap('PDFiumJS_Doc_get_page', 'number', ['number', 'number']),
			Page_get_width: cwrap('PDFiumJS_Page_get_width', 'number', ['number']),
			Page_get_height: cwrap('PDFiumJS_Page_get_height', 'number', ['number']),
			Page_get_bitmap: cwrap('PDFiumJS_Page_get_bitmap', 'number', ['number']),
			Bitmap_get_buffer: cwrap('PDFiumJS_Bitmap_get_buffer', 'number', ['number']),
			Bitmap_get_stride: cwrap('PDFiumJS_Bitmap_get_stride', 'number', ['number']),
			Bitmap_destroy: cwrap('PDFiumJS_Bitmap_destroy', null, ['number']),
			Page_destroy: cwrap('PDFiumJS_Page_destroy', null, ['number']),
		};
		
		self.PDFiumJS.opened_files = [];
		
		self.PDFiumJS.C.init();

		self.loadedDocs = new Map();

		self.PDFiumJS.initialized = true;
	}
};

/////////////////////////////////////////////////////////////////////////////////////////

/**
 * Receive messages
 */
self.onmessage = function (e) {
	var that = self;
	switch (e.data.command) {
		case 'ping':
			that.postMessage(e.data);
			break;
			
		case 'loadDocument':
			const endTime = Date.now();
			const loadTime = endTime - e.data.timestamp;
			
			if (showDebugMessages) {
				self.postMessage({
					command: 'consolemessage',
					message: 'PDFiumWrapper: Transferred ArrayBuffer in ' + loadTime + 'ms (' + e.data.id + ')'
				})
			}

			self.loadDocument(e.data.id, e.data.data)
			.then(function(doc) {
				that.postMessage({
					command: 'documentLoaded',
					id: e.data.id,
					pages: doc.getPagesDescriptor()
				}) 
			})
			.catch(function(err) {
				that.postMessage({
					command: 'error',
					id: e.data.id,
					error: err
				}) 
			});
			break;

		case 'destroyDocument':
			self.destroyDocument(e.data.id)
			.catch(function(err) {
				that.postMessage({
					command: 'error',
					id: e.data.id,
					error: err
				}) 
			});
			break;

		case 'destroyAll':
			self.destroyAll()
			.catch(function(err) {
				that.postMessage({
					command: 'error',
					error: err
				}) 
			});
			break;

		case 'renderPage':
			self.renderPage(e.data.id, e.data.index, e.data.width, e.data.height, e.data.devicePixelRatio)
			.then(function(image) {
				that.postMessage({
					command: 'pageRendered',
					id: e.data.id,
					index: e.data.index,
					pixels: image.data.buffer,
					width: image.width,
					height: image.height,
				}, [image.data.buffer]);			
			})
			.catch(function(err) {
				that.postMessage({
					command: 'error',
					id: e.data.id,
					error: err
				}) 
			});
			break;
	}
}

/////////////////////////////////////////////////////////////////////////////////////////

/**
 * Load a document
 */
self.loadDocument = async function(id, arraybuffer) {
	const startTime = Date.now();

	await self.waitReady();

	var buf = self.loadedDocs.get(id);
	if (buf) return Promise.resolve(buf);

	var doc = new PDFiumDocument(new Uint8Array(arraybuffer));
				
	self.loadedDocs.set(id, doc);
	
	const endTime = Date.now();
	const renderTime = endTime - startTime;

	if (showDebugMessages) {
		self.postMessage({
			command: 'consolemessage',
			message: 'PDFium Worker: Document loaded in ' + renderTime + 'ms (' + id + ')'
		})
	}

	return Promise.resolve(doc);
}

/**
 * Destroy a document
 */
self.destroyDocument = async function(id) {
	await self.waitReady();
	
	var buf = self.loadedDocs.get(id);
	if (!buf) {
		return Promise.reject({
			message: "PDF document " + id + " already destroyed"	
		});
	}
	
	buf.destroy();
	
	self.loadedDocs.delete(id);
	
	return Promise.resolve();
}

/**
 * Destroy all loaded documents
 */
self.destroyAll = async function() {
	await self.waitReady();
	
	for(var [key, value] of self.loadedDocs) {
		await self.destroyDocument(key);
	}
	
	return Promise.resolve();
}

/**
 * Render a page
 */
self.renderPage = async function(id, index, width, height, devicePixelRatio) {
	await self.waitReady();
	
	const startTime = Date.now();
	
	var doc = self.loadedDocs.get(id);
	if (!doc) {
		throw new Error("Document not loaded");
	}
	
	var page = doc.getPage(index);
	
	return Promise.resolve(
		page.render(width, height, devicePixelRatio)
		
	).then(function(image) {
		const endTime = Date.now();
		const renderTime = endTime - startTime;
	
		if (showDebugMessages) {
			self.postMessage({
				command: 'consolemessage',
				message: 'PDFium Worker: Page ' + index + ' rendered in ' + renderTime + 'ms (' + id + ')'
			})
		}
		
		return Promise.resolve(image);
	}); 
}

/**
 * Resolves when the PDFiumJS class is ready to be used.
 */
self.waitReady = async function() {
	if ((typeof self.PDFiumJS !== 'undefined') && self.PDFiumJS.initialized) {
		return Promise.resolve();
	}
	
	var that = self;
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			that.waitReady()
			.then(function() {
				resolve();
			})
			.catch(function(err) {
				reject(err);
			});
			
		}, 10);		
	});
}

/**
 * Finally, import the scripts. 
 */
importScripts('pdfium.js');           ///< Emscripten generated script (loaded the .mem file internally)
importScripts('PDFiumDocument.js');   ///< Model class(es) to be used in the worker

