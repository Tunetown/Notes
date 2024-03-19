/**
 * Dynamic styles
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
class Styles {
	
	constructor() {
		this.styles = {};
		this.counter = 0;
		
		this.styleElement = document.createElement('style');
		document.getElementsByTagName('head')[0].appendChild(this.styleElement);
	}
	
	/**
	 * Returns the name of a style holding the passed styles (as string!).
	 * If called with newStylesString, a new class is created, if no one is found with the exact same styles.
	 * If called without newStylesString, the class for ID is searched and returned, or an error is thrown if not found.
	 */
	getStyleClass(id, classPostfix, newStylesString) {
		if (!classPostfix) classPostfix = '';

		const hash = Tools.hashCode(id);
		
		// No styles passed: Search the style or throw if not found.
		if (!newStylesString) {
			if (!this.styles.hasOwnProperty(hash)) throw new Error('Style for ' + id + ' not found');
			return this.styles[hash].name;
		}
		
		var that = this;
		function create() {
			const styleName = 'dynstyle_' + (that.counter++);
			that.styles[hash] = {
				name: styleName,
				id: id,
				styles: newStylesString
			}
			
			that.styleElement.innerHTML += '\n.' + styleName + classPostfix +  ' { ' + newStylesString + ' }\n';
			return styleName;
		}
		
		// Styles passed: Create if necessary
		if (!this.styles.hasOwnProperty(hash)) {
			// Create new style the first time for this ID.
			return create();
		} else {
			if (this.styles[hash].styles != newStylesString) {
				// ID already present, but different styles: Create new one.
				return create();
			} else {
				// Read only
				return this.styles[hash].name;
			}
		}
	}
}
	