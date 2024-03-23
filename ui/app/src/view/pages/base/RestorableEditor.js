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
class RestorableEditor extends Editor {  
	
	/**
	 * Returns if the editor is in restore mode
	 */
	getRestoreMode() {
		return false;
	}

	/**
	 * Sets data which has to be loaded instead the data passed in load()
	 */
	setVersionRestoreData(data) {
		throw new Error('Must be implemented in child classes of RestorableEditor');
	}
}