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
	 * Returns promise holding a new PDFium document.
	 */
	getDocument(blob) {
		return this.#waitReady()
		.then(function() {
			return new Promise(function(resolve, reject) {
				var reader = new FileReader();
				reader.onload = function(e) {
					resolve(new PDFiumDocument(new Uint8Array(e.target.result)));
				};
				reader.readAsArrayBuffer(blob);
			});
		});
	}
	
	/**
	 * Resolves when the PDFiumJS class is ready to be used.
	 */
	#waitReady() {
		if ((typeof PDFiumJS !== 'undefined') && PDFiumJS.initialized) {
			return Promise.resolve();
		}
		
		var that = this;
		return new Promise(function(resolve, reject) {
			setTimeout(function() {
				that.#waitReady()
				.then(function() {
					resolve();
				})
				.catch(function(err) {
					reject(err);
				});
				
			}, 2);		
		});
	}
}
	
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
	
var Module = {
	TOTAL_MEMORY: 1024 * 1024 * 256,
	noExitRuntime: true,
	memoryInitializerPrefixURL: 'ui/lib/PDFium/',
	
	print: function() { 
		console.group.apply(console, arguments); 
		console.groupEnd();
	},
	
	printErr: function() { 
	    console.group.apply(console, arguments); 
	    console.groupEnd();
	},
	
	_main: function () {
		if (typeof PDFiumJS === 'undefined') {
			(typeof window !== 'undefined' ? window : this).PDFiumJS = {};
		}
		
		PDFiumJS.C = {
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
		
		PDFiumJS.opened_files = [];
		
		PDFiumJS.C.init();

		PDFiumJS.initialized = true;
	}
};

	