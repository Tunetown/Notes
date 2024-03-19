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
class Tab {  
	
	#app = null;
	#container = null;     // JQuery element
	
	#currentPage = null;   // Page or Editor object
	
	constructor(app) { 
		this.#app = app;
		this.#container = container;	
	}

	/**
	 * Clear content container
	 */
	clear() {
		this.#container.empty();
		this.#container.css('background', '');
		this.#container.scrollTop(0);
		this.#container.scrollLeft(0);
		this.#container.off('contextmenu');	
	}
	
	/**
	 * Hide tab
	 */
	hide() {
		this.#container.hide();
	}
	
	/**
	 * Show tab
	 */
	show() {
		this.#container.show();
	}
	
	/**
	 * Returns the JQuery DOM element of the tab
	 */
	getContainer() {
		return this.#container;
	}
	
	/**
	 * Loads a page or editor instance. 
	 */
	loadPage(newPage) {
		if (!(newPage instanceof Page)) throw new Exception('Invalid page');
		
		// Set references
		newPage.setApp(this.#app);
		newPage.setTab(this);
		
		this.#currentPage = newPage;
	}

	/**
	 * Returns the current editor. If the loaded page is just a page 
	 * and no Editor, null is returned.
	 */
	getCurrentEditor() {
		return (this.#currentPage instanceof Editor) ? this.#currentPage : null;
	}
	
	/**
	 * Returns the current page instance, if any (editors included).
	 */
	getCurrentPage() {
		return this.#currentPage ? this.#currentPage : null;
	}
	
	/**
	 * Returns the currently shown document's ID
	 */
	getCurrentlyShownId(editorsOnly) {
		if (this.#currentPage) {
			if (editorsOnly && !(this.#currentPage instanceof Editor)) return false;
			
			return this.#currentPage.getCurrentId();
		} 
		
		return false;
	}

	/**
	 * If there is an editor opened, reload it from database.
	 */	
	reloadCurrentPage() {
		var currentId = this.getCurrentlyShownId();
		if (!currentId) return Promise.resolve();     // No page loaded
		
		var that = this;
		return this.#app.documentAccess.loadDocumentsById([currentId])
		.then(function() {
			return that.#currentPage.load(that.#app.getData().getById(currentId));
		});
	}
}