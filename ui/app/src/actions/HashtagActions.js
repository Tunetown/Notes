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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!HashtagActions.instance) HashtagActions.instance = new HashtagActions();
		return HashtagActions.instance;
	}
	
	/**
	 * Sets the tags color in global metadata. Returns a promise.
	 */
	setColor(tag, color) {
		if (!tag) return Promise.resolve();
		tag = tag.toLowerCase();
		
		const m = MetaActions.getInstance();
		var meta = m.meta[Hashtag.metaFileName];
		if (!meta) meta = {};
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) {
			meta[hash] = {
				tag: tag
			};
		}
		
		meta[hash].color = color;
		
		m.meta[Hashtag.metaFileName] = meta;
		
		return m.saveGlobalMeta();
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
		
		const n = Notes.getInstance();
		const docs = n.getData().getDocumentsWithTag(tag);
		const tagColor = Hashtag.getColor(tag);
		
		// Load documents
		return DocumentAccess.getInstance().loadDocuments(docs)
		.then(function() {
			var promises = [];
			
			for (var i in docs) {
				// Re-load document from data instance
				var doc = n.getData().getById(docs[i]._id);
				if (!doc) {
					return Promise.reject({
						message: 'Document ' + docs[i]._id + ' not found'
					})
				}
				
				// Get list of tags including their coordinates in the content.
				const taglist = Hashtag.parse(doc.content);
				
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
					DocumentActions.getInstance().save(doc._id, newContent)
				);
			}
			
			return Promise.all(promises);
		})
		.then(function() {
			// Set color for new tag
			return HashtagActions.getInstance().setColor(newTag, tagColor);
		})
		.then(function() {
			// Reload tree
			return TreeActions.getInstance().requestTree();
		})
		.then(function() {
			return Promise.resolve({
				message: 'Renamed hashtag ' + Hashtag.startChar + tag + ' in ' + docs.length + ' documents with ' + Hashtag.startChar + newTag
			})			
		})
	}
}