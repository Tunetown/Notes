/**
 * Generic callbacks.
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
class ErrorHandler {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Handle an exception
	 */
	handle(something) {
		if (something instanceof Error) {
			// Error object: Show message to user
			this.#app.view.message(
				something.message, 
				something.notesDisplayType ? something.notesDisplayType : 'E'  // Custom display type (see Errors.js)
			);
			
			switch(something.notesDisplayType) {
			case 'E': console.error(something); break;
			case 'W': console.warn(something); break;
			case 'I': console.info(something); break;
			default: console.log(something); break;
			}
			
		} else if (typeof something == "string") {
			// Simple text message error
			this.#app.view.message(
				something, 
				'E'
			);
			
			console.error(something);			
			
		} else {
			console.error(something);
		}
	}
}
	