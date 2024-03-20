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
class Page {  
	
	_app = null;
	_tab = null;    // Reference to the tab where the page is loaded in
	
	/**
	 * Must be implemented in child classes to load the page. unload has
	 * been called before, no need to clean up.
	 */
	async load(data) {
		throw new Exception('Must be implemented in child classes of Page');
	}

	/**
	 * Must be implemented in child classes to unload the page.
	 */
	async unload() {
		throw new Exception('Must be implemented in child classes of Page');
	}

	/**
	 * Returns the current document. Must be implemented in child classes.
	 */
	getCurrentDoc() {
		return null;
	}
	
	/**
	 * Returns the current document's ID. Must be implemented in child classes.
	 */
	getCurrentId() {
		return false;
	}

	/**
	 * Optional override for the focus ID (TODO still necessary?)
	 */
	overrideFocusId() {
		return false;
	}

	////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Set main application instance. Must be called before usage.
	 */
	setApp(app) {
		this._app = app;
	}
	
	/**
	 * Set tab for the page. Must be called before usage.
	 */
	setTab(tab) {
		this._tab = tab;
	}
}