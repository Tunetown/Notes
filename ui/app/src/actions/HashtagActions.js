/**
 * Actions for hashtags.
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
class HashtagActions {
	
	static metaFileName = 'tagMeta';        // #IGNORE static 
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Sets the tags color in global metadata. Returns a promise.
	 */
	setColor(tag, color) {
		if (!tag) return Promise.resolve();
		tag = tag.toLowerCase();
		
		var meta = this.#app.actions.meta.meta[HashtagActions.metaFileName];
		if (!meta) meta = {};
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) {
			meta[hash] = {
				tag: tag
			};
		}
		
		meta[hash].color = color;
		
		this.#app.actions.meta.meta[HashtagActions.metaFileName] = meta;
		
		return this.#app.actions.meta.saveGlobalMeta();
	}
	
	/**
	 * Renames the passed tag in all documents where it is found.
	 */
	renameTag(tag, newTag) {
		newTag = Hashtag.trim(newTag);
		const tagL = Hashtag.trim(tag.toLowerCase());
		
		if (tagL == newTag.toLowerCase()) {
			// Old tag name equals new tag name after case conversion
			return Promise.resolve({
				message: 'Nothing changed.'
			});
		}
		
		const docs = this.#app.data.getDocumentsWithTag(tag);
		const tagColor = this.#app.hashtag.getColor(tag);
		var that = this;
		
		// Load documents
		return this.#documentAccess.loadDocuments(docs)
		.then(function() {
			var promises = [];
			
			for (var i in docs) {
				// Re-load document from data instance
				var doc = that.#app.data.getById(docs[i]._id);
				if (!doc) {
					return Promise.reject({
						message: 'Document ' + docs[i]._id + ' not found'
					})
				}
				
				// Get list of tags including their coordinates in the content.
				const taglist = that.#app.hashtag.parse(doc.content);
				
				// Replace all occurrences of the tag, trackking the index dilataion caused by differences in 
				// length between the old and the new tag.
				var newContent = doc.content;
				var dilatation = 0;
				for(var t in taglist) {
					var entry = taglist[t];
					if (entry.tag.toLowerCase() != tagL) continue;
					
					newContent = newContent.substring(0, entry.start + dilatation) + newTag + newContent.substring(entry.end + dilatation);
					dilatation += newTag.length - entry.tag.length;
				}
				
				// Collect promises to change the content.
				promises.push(
					that.#app.actions.document.save(doc._id, newContent)
				);
			}
			
			return Promise.all(promises);
		})
		.then(function() {
			// Set color for new tag
			return that.setColor(newTag, tagColor);
		})
		.then(function() {
			// Reload tree
			return that.#app.actions.nav.requestTree();
		})
		.then(function() {
			return Promise.resolve({
				message: 'Renamed hashtag ' + Hashtag.startChar + tag + ' in ' + docs.length + ' documents with ' + Hashtag.startChar + newTag
			})			
		})
	}
}