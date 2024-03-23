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
class Editor extends Page {  
	
	#dirty = false;       // Are there any unsaved changes?
	
	/**
	 * Returns the editor mode for this instance, as used in the document.
	 */
	getEditorMode() {
		throw new Error('Must be implemented in child classes of Editor');
	}
	
	/**
	 * Stop any pending auto-save callbacks
	 */
	async stopDelayedSave() {
	}
	
	/**
	 * Returns the content string
	 */
	getContent() {
		return false;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Call a document
	 */
	_callDocument(id) {
		this._app.nav.setSearchText('');
		this._app.routing.call(id);
	}

	//////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Resets the editors dirty state.
	 */
	resetDirtyState() {
		this.#dirty = false;
	}
	
	/**
	 * Sets the editor dirty.
	 */
	setDirty() {
		this.#dirty = true;
	}
	
	/**
	 * Returns if the editor is dirty (unsaved changes exist)
	 */
	isDirty() {
		return this.#dirty;
	}
}