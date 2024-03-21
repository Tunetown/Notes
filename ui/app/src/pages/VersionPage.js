/**
 * Shows a version of a note.
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
class VersionPage extends Page {
	
	#data = null;
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		if (!this.#data) return false;
		return this.#data.doc ? this.#data.doc._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		if (!this.#data) return null;
		return this.#data.doc ? this.#data.doc : null;
	}
	
	/**
	 * Unload instance
	 */
	async unload() {
		this.#data = null;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 * 
	 * {
	 *   id: version id
	 *   name: version name
	 *   data: Content of the version
	 *   doc: The original document
	 * }
	 */
	async load(data) {
		this.#data = data;

		// Set note name in the header
		this._tab.setStatusText("Version " + data.name + " of " + data.doc.name);

		if (data.doc.editor && (data.doc.editor == 'code')) {
			CodeMirror(this._tab.getContainer()[0], {
				value: data,
				mode:  (data.doc.editorParams && data.doc.editorParams.language) ? data.doc.editorParams.language : 'markdown',
				readOnly: true
			});
		} else {
			this._tab.getContainer().append(
				$('<div class="versiondata mce-content-body" contenteditable="false"/>')
				.html(data.data)
			);
		}

		// Build buttons
		var that = this;
		this._app.setButtons([ 
			!Document.canRestore(data.id) ? null : $('<div type="button" data-toggle="tooltip" title="Restore Version" class="fa fa-redo"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#restore();
			}),
			
			$('<div type="button" data-toggle="tooltip" title="Back to History" class="fa fa-times"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#leave();
			}),
		]);
	}
	
	/**
	 * Leave screen to the versions overview (which must be there because this is only called from there).
	 */
	#leave() {
		this._app.routing.call("history/" + this.#data.id);

		this.unload();
	}
	
	#restore() {
		if (!this.#data) return;
		
		Document.setRestoreData(this.#data.id, this.#data.data);
		
		// Request the note. This loads the note into the editor freshly, and because the restoreData 
		// is filled, the editor will show this data in its load() method, in dirty state but without autosaving.
		this._app.routing.call(this.#data.id);
		
		this.unload();
	}
}