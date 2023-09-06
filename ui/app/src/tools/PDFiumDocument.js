/**
 * Represents a PDF document 
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
		
		//this.pages = new Map();
	}
	
	/**
	 * Unload the document.
	 */
	destroy() {
		PDFiumJS.C.Doc_delete(this.docInternal);
		PDFiumJS.opened_files[this.fileId] = null;
		
		this.docInternal = null;
		/*
		for (let [key, value] of this.pages) {
			this.pages.get(key).destroy();
		}
		
		this.pages = new Map();*/
	}
	
	/**
	 * Returns a page instance.
	 */
	getPage(pageNum) {
		if (!this.docInternal) {
			throw new Error("Document already destroyed");
		}

		if ((pageNum < 0) || (pageNum >= this.numPages)) {
			throw new Error("Invalid page number: " + pageNum);
		}
		
		/*if (this.pages.get(pageNum)) {
			return this.pages.get(pageNum);
		}*/
		
		var ret = new PDFiumPage(this, pageNum);
		
		//this.pages.set(pageNum, ret);
		
		return ret;
	}
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

/**
 * Represents a PDF page.
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
	
	constructor(main, pageNum) {
		this.main = main;
		
		//this.width = PDFiumJS.C.Page_get_width(this.pageInternal);
		//this.height = PDFiumJS.C.Page_get_height(this.pageInternal);
		this.pageNum = pageNum;
	}
	
	/**
	 * Destroy the page.
	 *
	destroy() {
		PDFiumJS.C.Page_destroy(this.pageInternal);
		
		this.pageInternal = null;
	}
	
	/**
	 * Renders the page to the passed standard DOM canvas. 
	 *
	 * The canvas dimensions will be set to the PDFs page size if w/h are not supported, 
	 * but you can also determine yourself what the size should be.
	 */
	render(canvas, width, height) {
		if (!this.main.docInternal) {
			throw new Error("Document already destroyed");
		} 

		/*if (!this.pageInternal) {
			return Promise.reject({
				message: "Document already destroyed"
			});
		}*/ 
		
		try {
			var startTime = Date.now();

			//var canvas = canvas_list[cur_page];
			//var page = PDFiumJS.C.Doc_get_page(this.docInternal, pageNum);
			
			var page = PDFiumJS.C.Doc_get_page(this.main.docInternal, this.pageNum)
			
			if (!width) width = this.width;
			if (!height) height = this.height;
			
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';

			width *= window.devicePixelRatio;
			height *= window.devicePixelRatio;

			canvas.width = width;
			canvas.height = height;
    
			var bitmap = PDFiumJS.C.Page_get_bitmap(page, width, height);
			PDFiumJS.C.Page_destroy(page);
			
			var buf = PDFiumJS.C.Bitmap_get_buffer(bitmap);
			var stride = PDFiumJS.C.Bitmap_get_stride(bitmap);
			  
			var ctx = canvas.getContext('2d');
			var img = ctx.createImageData(width, height);
			var data = img.data;
			
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

			PDFiumJS.C.Bitmap_destroy(bitmap);
			ctx.putImageData(img, 0, 0);

			var endTime = Date.now();
			const renderTime = endTime - startTime;
			
			console.log('PDFium: Page ' + this.pageNum + ' rendered in ' + renderTime + 'ms');
			
			return Promise.resolve({
				renderTime: renderTime
			});
			
		} catch (e) {
			console.log('PDFium: Cannot render page', this.pageNum, e);
			
			return Promise.reject({
				message: 'Cannot render page ' + this.pageNum,
				err: e
			})
		}
	}
}
	