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
class VersionView {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!VersionView.instance) VersionView.instance = new VersionView();
		return VersionView.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 * 
	 * id/name: ID and version name
	 * data: Content of the version
	 * doc: The original document
	 */
	load(id, name, data, doc) {
		var n = Notes.getInstance();
		n.setCurrentPage(this);

		// Set note name in the header
		n.setStatusText("Version " + name + " of " + doc.name);

		if (doc.editor && (doc.editor == 'code')) {
			CodeMirror($('#contentContainer')[0], {
				value: data,
				mode:  (doc.editorParams && doc.editorParams.language) ? doc.editorParams.language : 'javascript'
			});
		} else {
			$('#contentContainer').append(
				$('<div id="versiondata" class="mce-content-body" contenteditable="false"/>').html(data)
			);
		}

		// Clear restore data
		Editor.getInstance().setVersionRestoreData(false);
		
		// Build buttons
		n.setButtons([ 
			//$('<div type="button" data-toggle="tooltip" title="Restore Version" class="fa fa-redo" onclick="event.stopPropagation();VersionView.getInstance().restore();"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Back to History" class="fa fa-times" onclick="event.stopPropagation();VersionView.getInstance().leave();"></div>'),
		]);
		
		// Remember properties
		this.versionId = id;
		this.versionName = name;
		this.versionContent = data;
	}
	
	/**
	 * Leave screen to the versions overview (which must be there because this is only called from there).
	 */
	leave() {
		Notes.getInstance().routing.call("history/" + this.versionId);

		this.versionId = false;
		this.versionName = false;
	}
	
	/**
	 * Switch to editor, load the current note and set the restored content from it.
	 *
	restore() {
		if (!this.current) return;
		Editor.getInstance().setVersionRestoreData(this.versionContent);
		
		// Request the note. This loads the note into the editor freshly, and because the restoreData 
		// is filled, the editor will show this data in its load() method, in dirty state but without autosaving.
		Notes.getInstance().routing.call(this.versionId);
		
		this.versionId = false;
		this.versionName = false;
	}
	*/
}