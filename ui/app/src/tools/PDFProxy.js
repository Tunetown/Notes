/**
 * PDF Rendering proxy. Manages which engine has to be used.
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

class PDFProxy {

	constructor() {
		this.engine = new PDFEnginePDFJS();
		
		this.engine.init();
	}

	getEngine() {
		return this.engine;
	}

}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

class PDFEnginePDFJS {
	async getDocument(blob, url) {
		if (!PDFEnginePDFJS.worker) throw new Error('Initialize first');
		
		return pdfjsLib.getDocument({
			url: url,
			worker: PDFEnginePDFJS.worker 
		})
		.promise
		.then(function(pdf) {
			return Promise.resolve(
				new PDFProxyDocumentPDFJS(pdf)
			)
		});
	}
	
	async init() {
		if (!PDFEnginePDFJS.worker) {
			pdfjsLib.GlobalWorkerOptions.workerSrc = '/ui/lib/PDFjs/pdf.worker.js';
			PDFEnginePDFJS.worker = new pdfjsLib.PDFWorker();
		}
		
		return Promise.resolve();
	}
	
	destroyAll() {
		// Nothing to do here
	}
	
	get name() {
		return "PDF.js";
	}
}

PDFEnginePDFJS.worker = null;  // Global worker for PDF.js


class PDFProxyDocumentPDFJS {
	constructor(pdf) {
		this.pdf = pdf;
	}
	
	async getPage(index) {
		var that = this;
		return this.pdf.getPage(index + 1)
		.then(function(page) {
			return Promise.resolve(
				new PDFProxyPagePDFJS(that, page, index)
			);
		});
	}
	
	get numPages() {
		return this.pdf.numPages;
	}
	
	destroy() {
		if (!this.pdf) return;
		this.pdf.destroy();
		this.pdf = null;
	}
}

class PDFProxyPagePDFJS {
	constructor(doc, page, index) {
		this.doc = doc;
		this.page = page;
		this.index = index;
	}
	
	getDimensions() {
		const viewport = this.page.getViewport({ scale: 1 });
		return {
			width: viewport.width,
			height: viewport.height
		};
	}
	
	async render(canvas, width, height) {
		const startTime = Date.now();
		
		const viewport = this.page.getViewport({ scale: 1 });
		
		var scale = width / viewport.width;
		var scaledViewport = this.page.getViewport({ scale: scale });
		
		canvas.style.height = Math.floor(height) + 'px';
		canvas.style.width = Math.floor(width) + 'px';  
		
		canvas.height = Math.floor(height);
		canvas.width = Math.floor(width);  

		var context = canvas.getContext('2d');

		return this.page.render({
			canvasContext: context,
			transform: null,
			viewport: scaledViewport
		}).promise
		.then(function() {
			return Promise.resolve({
				renderTime: Date.now() - startTime
			});
		});
	}
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

class PDFEnginePDFium {
	async getDocument(blob, url) {
		if (!this.pdfium) throw new Error('Initialize first');
		
		const id = crypto.randomUUID();
		
		return this.pdfium.getDocument(id, blob)
		.then(function(pdf) {
			return Promise.resolve(
				new PDFProxyDocumentPDFium(id, pdf)
			);
		});
	}

	async init() {
		if (!this.pdfium) {
			this.pdfium = new PDFiumWrapper();
			return this.pdfium.initWorker();			
		}
		
		return Promise.resolve();
	}

	destroyAll() {
		if (this.pdfium) {
			this.pdfium.destroyAll();
		}
	}
	
	get name() {
		return "PDFium";
	}
}

class PDFProxyDocumentPDFium {
	constructor(id, doc) {
		this.id = id;
		this.doc = doc;
	}
	
	async getPage(index) {
		var that = this;
		var page = this.doc.getPage(index);
		return Promise.resolve(
			new PDFProxyPagePDFium(that, page, index)
		);
	}
	
	get numPages() {
		return this.doc.numPages;
	}
	
	destroy() {
		if (!this.doc) return;
		this.doc.destroy();
		this.doc = null;
	}

}

class PDFProxyPagePDFium {
	constructor(doc, page, index) {
		this.doc = doc;
		this.page = page;
		this.index = index;
	}
	
	getDimensions() {
		return this.page.getDimensions();
	}
	
	async render(canvas, width, height) {
		const startTime = Date.now();
		
		return this.page.render(canvas, width, height)
		.then(function() {
			return Promise.resolve({
				renderTime: Date.now() - startTime
			});
		});
	}
}

