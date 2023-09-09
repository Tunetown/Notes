/**
 * Represents a PDF document (used inside the PDFiumWorker)
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
class PDFiumDocument {
	
	/**
	 * An ArrayBuffer is needed here.
	 */
	constructor(arrayBuffer) {
		this.fileId = PDFiumJS.opened_files.length;
		
		PDFiumJS.opened_files[this.fileId] = arrayBuffer;
  
		this.docInternal = PDFiumJS.C.Doc_new(this.fileId, arrayBuffer.length);
		
		this.numPages = PDFiumJS.C.Doc_get_page_count(this.docInternal);
	}
	
	/**
	 * Unload the document.
	 */
	destroy() {
		PDFiumJS.C.Doc_delete(this.docInternal);
		PDFiumJS.opened_files[this.fileId] = null;
		
		this.docInternal = null;
	}
	
	/**
	 * Returns an array which holds info about all available pages of the document.
	 */
	getPagesDescriptor() {
		if (!this.docInternal) {
			throw new Error("Document already destroyed");
		}
		
		var ret = [];
		for(var p=0; p<this.numPages; ++p) {
			var page = this.getPage(p);
			
			ret.push({
				index: p,
				dimensions: page.getDimensions()
			});
		}
		return ret;
	}
	
	/**
	 * Returns a page instance.
	 */
	getPage(index) {
		if (!this.docInternal) {
			throw new Error("Document already destroyed");
		}

		if ((index < 0) || (index >= this.numPages)) {
			throw new Error("Invalid page number: " + index);
		}
		
		var ret = new PDFiumPage(this, index);
		return ret;
	}
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

/**
 * Represents a PDF page (used inside the PDFiumWorker).
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
class PDFiumPage {
	
	constructor(main, index) {
		this.main = main;
		this.index = index;
	}
	
	/**
	 * Returns the page size.
	 */
	getDimensions() {
		if (this.dimensions) return this.dimensions;
		
		var page = PDFiumJS.C.Doc_get_page(this.main.docInternal, this.index);
		this.dimensions = {
			width: PDFiumJS.C.Page_get_width(page),
			height: PDFiumJS.C.Page_get_height(page)
		}
		PDFiumJS.C.Page_destroy(page);
		
		return this.dimensions;
	}
	
	/**
	 * Renders the page to an image.
	 */
	render(width, height, devicePixelRatio) {
		if (!this.main.docInternal) {
			throw new Error("Document already destroyed");
		} 
		
		//const startTime = Date.now();
		
		var page = PDFiumJS.C.Doc_get_page(this.main.docInternal, this.index)

		//console.log('Page render: got page at ' + (Date.now() - startTime) + "ms");
		
		width *= devicePixelRatio;
		height *= devicePixelRatio;

		var bitmap = PDFiumJS.C.Page_get_bitmap(page, width, height);  // This is the expensive one!

		//console.log('Page render: got bitmap at ' + (Date.now() - startTime) + "ms");

		PDFiumJS.C.Page_destroy(page);
		
		//console.log('Page render: page destroyed at ' + (Date.now() - startTime) + "ms");
		
		var buf = PDFiumJS.C.Bitmap_get_buffer(bitmap);
		var stride = PDFiumJS.C.Bitmap_get_stride(bitmap);
		  
		var canvas = new OffscreenCanvas(width, height);
		var ctx = canvas.getContext('2d');
		var img = ctx.createImageData(width, height);
		var data = img.data;
		
		//console.log('Page render: start copy at ' + (Date.now() - startTime) + "ms");
		
		var off = 0;
		for(var h = 0; h < height; ++h) {
			var ptr = buf + stride * h;
			
			for(var w = 0; w < width; ++w) {
				data[off++] = HEAPU8[ptr+2];
				data[off++] = HEAPU8[ptr+1];
				data[off++] = HEAPU8[ptr];
				data[off++] = 255;
				ptr += 4;
			}
		}
		
		//console.log('Page render: end copy at ' + (Date.now() - startTime) + "ms");

		PDFiumJS.C.Bitmap_destroy(bitmap);

		//console.log('Page render: bitmap destroyed at ' + (Date.now() - startTime) + "ms");

		return img;
	}
}
