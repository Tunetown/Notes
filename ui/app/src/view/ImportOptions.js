/**
 * Note taking app - Main application controller class.  
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
class ImportOptions {  
	
	content = null;    // Content to be shown (JQuery DOM)
	
	#definitions = null;
	
	constructor(definitions) {
		this.#definitions = definitions;
		
		var rows = [];

		// Compose rows
		for(var d in this.#definitions) {
			var def = this.#definitions[d];
			
			// Create input			
			switch (def.type) {
				case 'checkbox':
					def.input = $('<input type="checkbox" ' + (def.defaultValue ? 'checked' : '') + ' />')
					break;
					
				default:
					throw new Error('Unknown importer option type: ' + def.type);
			}
			
			// Create row
			rows.push(
				$('<tr />').append(
					$('<td />').text(
						def.text
					),
					
					$('<td />').append(
						def.input	
					)
				)
			);
		}
		
		// Create table
		this.content = $('<table class="importOptionsTable" />').append(
			$('<tbody />').append(
				rows
			)
		);
	}
	
	/**
	 * Returns the definitions enriched with current values.
	 */
	getOptions() {
		for(var d in this.#definitions) {
			var def = this.#definitions[d];
			
			switch (def.type) {
				case 'checkbox':
					def.value = !!def.input.is(':checked');
					break;
										
				default:
					throw new Error('Unknown importer option type: ' + def.type);
			}
		}
		
		return this.#definitions;
	}
}