/**
 * Tool functions
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
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
class Tools {

	/**
	 * Loads multiple scripts. Returns a promise.
	 */
	static getScripts(urls) {
		var promises = [];
		
		for(var u in urls) {
			var url = urls[u];
			
			promises.push(new Promise(function(resolve, reject) {
				$.getScript(url)
				.done(function(script, textStatus) {
					resolve({
						ok: true,
						script: script,
						textStatus: textStatus
					});
				})
				.fail(function(jqxhr, msg) {
					reject({
						jqxhr: jqxhr,
						message: 'Error loading script (' + msg + '), status ' + jqxhr.status,
						messageThreadId: 'GetScriptMessages'
					});
				});
			}));
		}
		
		return Promise.all(promises);
	}
	
	/**
	 * Returns an array only holding unique entries from arr.
	 */
	static removeDuplicates(arr) {
		var uniqueNames = [];
		$.each(arr, function(i, el){
		    if($.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
		});
		return uniqueNames;
	}
	
	/**
	 * Returns if there is internet connection
	 */	
	static isOnline() {
		if ('connection' in navigator) {
			return navigator.onLine;
		} else return true; 
	}
	
	/**
	 * Unicode aware Base64 encoding
	 */
	static b64EncodeUnicode(str) {
	    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
	        function toSolidBytes(match, p1) {
	            return String.fromCharCode('0x' + p1);
	    }));
	}
	
	/**
	 * Unicode aware Base64 decoding
	 */
	static b64DecodeUnicode(str) {
	    return decodeURIComponent(atob(str).split('').map(function(c) {
	        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
	    }).join(''));
	}
	
	/**
	 * Convert file size in integer bytes to a human readable format.
	 */
	static convertFilesize(size) {
		if (size == 0) return "Empty";
		if (!size || size < 0) return "(!)";
		var i = Math.floor(Math.log(size) / Math.log(1024));
		return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
	}
	
	/**
	 * For a given time, this returns the amount of time passed since then, in a readable format.
	 * Taken from https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
	 */
	static getTimeSinceDisplay(time) {
		switch (typeof time) {
		case 'number':
			break;
		case 'string':
			time = +new Date(time);
			break;
		case 'object':
			if (time.constructor === Date) time = time.getTime();
			break;
		default:
			time = +new Date();
		}
		
		var time_formats = [
			[60, 'seconds', 1], // 60
			[120, '1 minute ago', '1 minute from now'], // 60*2
			[3600, 'minutes', 60], // 60*60, 60
			[7200, '1 hour ago', '1 hour from now'], // 60*60*2
			[86400, 'hours', 3600], // 60*60*24, 60*60
			[172800, '1 day ago', '1 day from now'], // 60*60*24*2
			[604800, 'days', 86400], // 60*60*24*7, 60*60*24
			[1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
			[2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
			[4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
			[29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
			[58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
			[2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
			[5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
			[58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
		];
		var seconds = (+new Date() - time) / 1000;
		var token = 'ago';
		var list_choice = 1;
		
		if (seconds >= 0 && seconds < 2) {
			return 'Just now'
		}
		  
		if (seconds < 0) {
			seconds = Math.abs(seconds);
			token = 'from now';
			list_choice = 2;
		}
	
		var i = 0;
		var format;
		while (format = time_formats[i++]) {
			if (seconds < format[0]) {
				if (typeof format[2] == 'string') {
					return format[list_choice];
				} else {
					return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
				}
			}
		}
		
		return time;
	}
	
	/**
	 * Deep object comparison. Taken from https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
	 * This reports all errors in the errorList array. If this is empty afterwards, the objects are truly equal.
	 */
	static compareObjects(x, y, errorList, propName) {
		// If both x and y are null or undefined and exactly the same
		if (x === y) return;

		// If they are not strictly equal, they both need to be Objects
		if (!(x instanceof Object) || !(y instanceof Object)) {
			errorList.push("Type mismatch");
			return;
		}

		// They must have the exact same prototype chain, the closest we can do is
		// test there constructor.
		if (x.constructor !== y.constructor) {
			errorList.push("Class mismatch");
			return;
		}

		for (var p in x) {
			// Other properties were tested using x.constructor === y.constructor
			if (!x.hasOwnProperty(p)) continue;

			// Allows to compare x[ p ] and y[ p ] when set to undefined
			if (!y.hasOwnProperty(p)) {
				errorList.push("Property missing: " + p);
			}

			// If they have the same strict value or identity then they are equal
			if (x[p] === y[p]) continue;

			// Numbers, Strings, Functions, Booleans must be strictly equal
			if (typeof(x[p]) !== "object") {
				errorList.push("Property mismatch: " + p);
				if (propName) errorList.push("  Property parent: " + propName);
				errorList.push("  Value in first object: " + JSON.stringify(x[p]));
				errorList.push("  Value in second object: " + JSON.stringify(y[p]));
			} else {
				// Objects and Arrays must be tested recursively
				Tools.compareObjects( x[ p ],  y[ p ], errorList, p);
			}
		}

		for (p in y) {
			if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) {
				// Allows x[ p ] to be set to undefined
				errorList.push("Property mismatch: " + p);
			}
		}
	}
	
	/**
	 * Generate 8 character uuids.
	 */
	static getUuid() {
		return Date.now().toString(36);
	}
	
	/**
	 * Returns the part of the URL after the last slash, or the whole url if no slash is there.
	 */
	static getBasename(url) {
		var splt = url.split('/');
		if (splt && splt.length > 0) {
			return splt[splt.length - 1];
		}
		return url;
	}
	
	/**
	 * Append leading zeroes to a number. Taken from:
	 * https://stackoverflow.com/questions/2998784/how-to-output-numbers-with-leading-zeros-in-javascript
	 */
	static pad(num, size) {
	    num = num.toString();
	    while (num.length < size) num = "0" + num;
	    return num;
	}
	
	/**
	 * Change color brightness. Taken from https://css-tricks.com/snippets/javascript/lighten-darken-color/
	 */
	static lightenDarkenColor(col, amt) {
	    var usePound = false;
	  
	    if (col[0] == "#") {
	        col = col.slice(1);
	        usePound = true;
	    }
	 
	    var num = parseInt(col,16);

	    var r = (num >> 16) + amt;
	    if (r > 255) r = 255;
	    else if  (r < 0) r = 0;
	 
	    var b = ((num >> 8) & 0x00FF) + amt;
	    if (b > 255) b = 255;
	    else if  (b < 0) b = 0;
	 
	    var g = (num & 0x0000FF) + amt;
	    if (g > 255) g = 255;
	    else if (g < 0) g = 0;
	 
	    return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
	}
	
	/**
	 * Tries to extract the X position from an event
	 */
	static extractX(event) {
		if (event.pageX) return event.pageX;
		if (event.touches && event.touches.length > 0) return event.touches[0].pageX;
		if (event.originalEvent) return Tools.extractX(event.originalEvent);
		return -1;
	}
	
	/**
	 * Tries to extract the X position from an event
	 */
	static extractY(event) {
		if (event.pageY) return event.pageY;
		if (event.touches && event.touches.length > 0) return event.touches[0].pageY;
		if (event.originalEvent) return Tools.extractY(event.originalEvent);
		return -1;
	}

	/**
	 * Adjusts the width of the select element (jquery object) to the selected option.
	 */
	static adjustSelectWidthToValue(select) {
		var text = select.find('option:selected').text();
		var aux = $('<select class="' + select.attr('class') + '"/>').append($('<option/>').text(text));
		select.after(aux);
		select.width(aux.width());
		aux.remove();
	}
	
	/**
	 * Merge an array of check responses.
	 */
	static mergeCheckResponses(arr) {
		var ret = {
			ok: true,
			errors: []
		};
		
		for (var a in arr) {
			if (arr[a].errors) {
				for (var i in arr[a].errors) {
					ret.errors.push(arr[a].errors[i])
				}
			}

			if (!arr[a].ok)	ret.ok = false;
		}
		
		return ret;
	}
	
	/**
	 * Returns if value is a numeric value.
	 */
	static isNumber(value) {
		return typeof value === 'number';
	}
	
	/**
	 * Makes the passed table jquery element sortable by its headers. The table must contain TH elements in the thead
	 * and td elements in the rows exclusively. All rows must be equally filled.
	 * 
	 * options:
	 * - startIndex:        Index to start sorting from (everything above will not be touched). Defaults to 1, and must not be less than 1.
	 * - sortData: [        Array of definitions. Can be used to define another sorting data source for specific columns. If not specified, 
	 *                      the innerHTML property will be used. Items have to be defined like follows:
	 *      {
	 *         colIndex:    Index of the column to define the data source
	 *         getValue:    Callback which must return the value to sort with. The TD element is passed as first and only parameter.
	 *      }
	 *   ]
	 * - excludeColumns:    Array of column numbers to exclude from sorting.
	 */
	static makeTableSortable(table, options) {
		if (!options) options = {};
		
		table.find('thead th').each(function(i) {
			if (options.excludeColumns) {
				for(var e in options.excludeColumns) {
					if (options.excludeColumns[e] == i) return;
				}
			}
			
			$(this).css('cursor', 'pointer');
			$(this).data('text', $(this).html());
			
			$(this).off('click');
			$(this).on('click', function(e) {
				e.stopPropagation();
				
				if (table[0].rows.length > 150) {
					if (!confirm('The table has ' + table[0].rows.length + ' entries, sorting may be slow. Really try it?')) return;
				}

				var that = this;
				setTimeout(function() {
					var getValue = null;
					if (options.sortData) {
						for(var d in options.sortData) {
							if (options.sortData[d].colIndex == i) {
								getValue = options.sortData[d].getValue;
							}
						}						
					}
					
					var dir = Tools.sortTable(table[0], i, options.startIndex, getValue);
					
					table.find('thead th').each(function(ii) {
						$(this).html($(this).data().text);
					});
					
					$(that).html($(that).data().text + ' <span class="fa fa-' + ((dir == "asc") ? 'long-arrow-alt-up' : 'long-arrow-alt-down') + '"></span>');
				}, 0);
			});
		});
	}
	
	/**
	 * Sort HTML table (taken from https://www.w3schools.com/howto/howto_js_sort_table.asp).
	 * Returns asc or desc.
	 */
	static sortTable(table, n, startIndex, getValueCallback) {
		var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;

		if (!startIndex || (startIndex < 1)) startIndex = 1;
		
		switching = true;

		// Set the sorting direction to ascending:
		dir = "asc";

		// Make a loop that will continue until no switching has been done
		while (switching) {
			// Start by saying: no switching is done:
			switching = false;
			rows = table.rows;
			
			// Loop through all table rows (except the first, which contains table headers) 
			var rowlen = rows.length;
			for (i=startIndex; i<(rowlen - 1); ++i) {
				// Start by saying there should be no switching:
				shouldSwitch = false;
				
				// Get the two elements you want to compare, one from current row and one from the next
				x = rows[i].getElementsByTagName("TD")[n];
				y = rows[i + 1].getElementsByTagName("TD")[n];

				var xData = getValueCallback ? getValueCallback(x) : x.innerHTML.toLowerCase();
				var yData = getValueCallback ? getValueCallback(y) : y.innerHTML.toLowerCase();
				
				// Check if the two rows should switch place, based on the direction, asc or desc
				if (dir == "asc") {
					if (xData > yData) {
						// If so, mark as a switch and break the loop:
						shouldSwitch = true;
						break;
					}
				} else if (dir == "desc") {
					if (xData < yData) {
						// If so, mark as a switch and break the loop:
						shouldSwitch = true;
						break;
					}
				}
			}
			
			if (shouldSwitch) {
				// If a switch has been marked, make the switch and mark that a switch has been done
				rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
				switching = true;
				
				// Each time a switch is done, increase this count by 1:
				++switchcount;
			} else {
				// If no switching has been done AND the direction is "asc", set the direction to "desc" and run the while loop again.
				if (switchcount == 0 && dir == "asc") {
					dir = "desc";
					switching = true;
				}
			}
		}
		
		return dir;
	}

	/**
	 * Initialize dropping files for the passed array of elements. Each element must be an object looking like this:
	 * 
	 * {
	 *     elements:              The JQuery element selectors to attach to.
	 *     callback(files, el):   function handling the dropping. Argument is an array of files, and e reference to this definition object.
	 * }
	 * 
	 * When the user drops files onto the elements defined, the respective callbacks will be called.
	 */
	static dropFilesInto(definitions) {
		function preventDefaults (e) {
			e.preventDefault()
			e.stopPropagation()
		}
	
		function handleDrop(e, definition, element) {
			var dt = e.dataTransfer;
			var files = dt.files;

			definition.callback(([...files]), definition, element); 
		}
		
		;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
			definitions.forEach(definition => {
				definition.elements.each(i => {
					definition.elements[i].addEventListener(eventName, preventDefaults, false);
				});
			});
		});
		
		definitions.forEach(definition => {
			definition.elements.each(i => {
				definition.elements[i].addEventListener('dragenter', function(event) {
					event.dataTransfer.dropEffect = "copy";
				}, false);
			});
		});
		
		;['dragenter', 'dragover'].forEach(eventName => {
		});

		;['dragleave', 'drop'].forEach(eventName => {
		})

		definitions.forEach(definition => {
			definition.elements.each(i => {
				definition.elements[i].addEventListener('drop', e =>  {
					handleDrop(e, definition, definition.elements[i]);
				}, false);
			});
		});
	}
	
	/**
	 * Returns a hash code from a string
	 *
	 * @param  {String} str The string to hash.
	 * @return {Number}    A 32bit integer
	 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
	 */
	static hashCode(str) {
		var hash = 0;
		for (var i = 0, len = str.length; i < len; i++) {
			var chr = str.charCodeAt(i);
			hash = (hash << 5) - hash + chr;
			hash |= 0; // Convert to 32bit integer
		}
		return hash;
	}
	
	/**
	 * Returns the size properties of an image url.
	 */
	static getImageSize(url) {
		return new Promise((resolve, reject) => {
			var img = new Image();
			$(img).on('load', function() {
				resolve({
					width: img.width,
					height: img.height
				});
			});
			img.src = url;
		});
	}
	
	/**
	 * Convert file data to base64. Returns a promise.
	 */
	static fileToBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result);
			reader.onerror = error => reject(error);
		});
	}
	
	/**
	 * https://jsfiddle.net/Mottie/xcqpF/316/
	 *
	static rgb2hex(orig) {
		 var rgb = orig.replace(/\s/g,'').match(/^rgba?\((\d+),(\d+),(\d+)/i);
		 return (rgb && rgb.length === 4) ? "#" +
		  ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
		  ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
		  ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : orig;
	}*/
}