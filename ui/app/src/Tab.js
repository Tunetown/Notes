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
	#container = null;     // JQuery element containing the pages. 

	#currentPage = null;   // Page or Editor object
	
	constructor(app, container) { 
		this.#app = app;
		this.#container = container;	
	}

	/**
	 * Loads a page or editor instance. The pages have to be loaded 
	 * with content before being passed here.
	 */
	async loadPage(newPageInstance, data) {
		if (!(newPageInstance instanceof Page)) throw new Exception('Invalid page');
		
		// Unload old page if any
		await this.unload();
		
		// Set references
		newPageInstance.setApp(this.#app);
		newPageInstance.setTab(this);
		
		this.#currentPage = newPageInstance;
		
		this.show();
		
		await this.#currentPage.load(data);
	}
	
	/**
	 * If there is a page, its content is set to data.
	 */
	async setPageData(data) {
		if (!this.isLoaded()) return;
		
		await this.reset();
		
		await this.#currentPage.load(data);
	}
	
	/**
	 * Unload the page if any
	 */
	async unload() {
		await this.reset();

		this.#currentPage = null;
	}

	/**
	 * Reset the page
	 */
	async reset() {	
		if (this.#currentPage) {
			await this.#currentPage.unload();
		}
		
		this.#resetContainer();
		this.resetEditorDirtyState();
		this.setStatusText();
	}
	
	//////////////////////////////////////////////////////////////////////////////////

	/**
	 * Set tab status text
	 */
	setStatusText(text) {
		this.#app.setStatusText(text);
	}
	
	//////////////////////////////////////////////////////////////////////////////////

	/**
	 * If a page is loaded, this returns a page focus override ID if any.
	 */
	overrideFocusId() {
		if (!this.isLoaded()) return false;
		
		return this.#currentPage.overrideFocusId();
	}

	/**
	 * If an editor is loaded, the dirty state is reset.
	 */
	resetEditorDirtyState() {
		if (!this.isEditorLoaded()) return;
		
		this.#currentPage.resetDirtyState();
	}
	
	/**
	 * If an editor is loaded, returns if it is dirty.
	 */
	isEditorDirty() {
		if (!this.isEditorLoaded()) return false;
		
		return this.#currentPage.isDirty();
	}
	
	/**
	 * If an editor is loaded, stops its save handlers
	 */
	stopEditorDelayedSave() {
		if (!this.isEditorLoaded()) return;
		
		this.#currentPage.stopDelayedSave();		
	}
	
	/**
	 * If an editor is loaded, returns its content
	 */
	getEditorContent() {
		if (!this.isEditorLoaded()) return false;
		
		return this.#currentPage.getContent();
	}
	
	/**
	 * If the current page is a restorable editor, this returns if it is in restore mode.
	 */
	getEditorRestoreMode() {
		if (!this.isRestorableEditorLoaded()) return false;
		
		return this.#currentPage.getRestoreMode();
	}
	
	/**
	 * Returns if a page is loaded.
	 */
	isLoaded() {
		return !!this.#currentPage;
	}
	
	/**
	 * Returns if the current page is an editor.
	 */
	isEditorLoaded() {
		return (this.#currentPage instanceof Editor);
	}
	
	/**
	 * Returns if the current page is a restorable editor.
	 */
	isRestorableEditorLoaded() {
		return (this.#currentPage instanceof RestorableEditor);
	}
	
	//////////////////////////////////////////////////////////////////////////////////

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
		if (!this.isLoaded()) return false;
		if (editorsOnly && !this.isEditorLoaded()) return false;
		
		return this.#currentPage.getCurrentId();
	}

	/**
	 * Returns the currently shown document
	 */
	getCurrentlyShownDoc(editorsOnly) {
		if (!this.isLoaded()) return null;
		if (editorsOnly && !this.isEditorLoaded()) return null;
			
		return this.#currentPage.getCurrentDoc();
	}
	
	//////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns the JQuery DOM element of the tab
	 */
	getContainer() {
		return this.#container;
	}
	
	/**
	 * Reset container
	 */
	#resetContainer() {
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
}