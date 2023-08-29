/**
 * Setlist: Shows all its children side by side
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
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
class Setlist {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Setlist.instance) Setlist.instance = new Setlist();
		return Setlist.instance;
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	load(id) {
		var n = Notes.getInstance();
		var d = n.getData();
		var doc = d.getById(id);
		if (!doc) throw new Error("Document " + id  + " not found");
		
		this.current = doc;
		this.currentIndex = 0;
		
		this.children = NoteTree.getInstance().getRelatedDocuments(id);

		n.setStatusText('Setlist: ' + doc.name + ' (' + (this.currentIndex+1) + ' of ' + this.children.length + ' items)');

		n.setCurrentPage(this);

		this.#buildContent($('#contentContainer'));
	}
	
	#buildContent(containerElement) {
		containerElement.empty();
		
		this.content = $('<div id="setlistContent"/>');
		containerElement.append(this.content);
		
		for(var c in this.children) {
			
		}
	}
}
	