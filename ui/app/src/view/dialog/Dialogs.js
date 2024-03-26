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
class Dialogs {  
	
	#view = null;
	
	constructor(view) {
		this.#view = view;
	}
	
	/**
	 * Simple dialog for prompting a textual value.
	 */
	async prompt(question, defaultValue) {
		return prompt(question, defaultValue);
	}
	
	/**
	 * Dialog for uploading files to a target parent doc.
	 */
	async promptFileUploadTarget(question, defaultTargetId) {
		// Get all existing references
		var existingRefs = [];
		this.#view.app.data.each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var targetSelector = this.#view.getDocumentSelector(existingRefs);
		targetSelector.val(defaultTargetId);
		
		var answer = await this.#view.getDialog().confirm(question, [ 
			targetSelector 
		]);
		
		if (!answer) throw new InfoError('Action canceled');

		return targetSelector.val();
	}
}