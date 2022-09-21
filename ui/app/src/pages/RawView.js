/**
 * Raw JSON view
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
class RawView {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!RawView.instance) RawView.instance = new RawView();
		return RawView.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	load(doc) {
		var n = Notes.getInstance();
		
		this.current = doc;
		
		n.setStatusText("Raw JSON data: " + doc.name);
		
		this.editor = CodeMirror($('#contentContainer')[0], {
			value: JSON.stringify(Document.clone(doc), null, 4),
			mode:  'javascript',
			lineNumbers: true
		});
		
		this.editor.on('focus', function(obj) {
			Notes.getInstance().hideOptions();
		});
		
		// Buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Back to standard editor" class="fa fa-times" onclick="event.stopPropagation();RawView.getInstance().back()"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Save" class="fa fa-save" onclick="event.stopPropagation();RawView.getInstance().save()"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Export including children..." class="fa fa-file-export" onclick="event.stopPropagation();RawView.getInstance().exportCompletely()"></div>') 
		]);	
	}
	
	/**
	 * Switch back to the standard editor.
	 */
	back() {
		Notes.getInstance().routing.call(this.current._id);
	}
	
	/**
	 * Export (download as JSON file) completely with all children.
	 */
	exportCompletely() {
		if (!this.current) return;
		
		var children = Notes.getInstance().getData().getChildren(this.current._id, true);
		
		var ids = [this.current._id];
		for(var d in children) {
			ids.push(children[d]._id);
		}
		
		if (!confirm('Download JSON export data of ' + this.current.name + ' including its contents (' + ids.length + ' documents)?')) return;
		
		DocumentAccess.getInstance().exportDocuments(ids)
		.then(function(data) {
			Notes.getInstance().showAlert('Exported ' + children.length + ' documents.', 'S', 'ExportDocsMessages');
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Save current data
	 */
	save() {
		if (!this.editor) return;
		
		if (!confirm('Really save the raw document data? This could lead to inconsistencies.')) return;
		
		var doc = JSON.parse(this.editor.getValue());
		
		DocumentAccess.getInstance().saveDbDocument(doc)
		.then(function(data) {
			return TreeActions.getInstance().requestTree();
		})
		.then(function(data) {
			Notes.getInstance().showAlert('Saved ' + (doc.name ? doc.name : 'the document') + '.', 'S', 'SaveDbDocMessages');
			
			if (doc._id) Notes.getInstance().routing.call('raw/' + doc._id);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Unload instance
	 */
	unload() {
		this.current = null;
	}
}