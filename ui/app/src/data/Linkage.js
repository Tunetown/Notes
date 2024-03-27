/**
 * Handling of linkage stuff.
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

class Linkage {
	
	/**
	 * Tags and separators for internal links.
	 */
	static startTag = '[[';        ///< Link start tag (must be 2 characters long! else you have to adapt the editors.)
	static endTag = ']]';          ///< Link end tag (must be 2 characters long! else you have to adapt the editors.)
	static separator = '|';        ///< Separator between target and visual text

	/**
	 * All of these follow the ones defined above!
	 */
	static startChar = '[';        ///< First character of the start tag (must match the above!)
	static startTagRest = '[';     ///< Rest of the start tag after the first character (must match the above!)
	
	/**
	 * Composes the links from the target and the (optional) visible text.
	 */
	static composeLink(target, text) {
		return '[[' + target + (text ? ('|' + text) : '') + ']]';
	}
	
	/**
	 * Splits the link into target and visible text.
	 */
	static splitLink(text) {
		if (!text) return null;
		
		const textNoBrackets = text.replaceAll('[', '').replaceAll(']', '');
		const spl = textNoBrackets.split('|');

		var target = "";
		var text = "";
		
		if (spl.length == 0) return null;
		if (spl.length >= 1) {
			target = spl[0];
		}
		if (spl.length > 1) {
			text = spl[1];
		}
		return {
			target: target,
			text: text
		}
	}
	
	/**
	 * Parses the passed string and returns an array of metadata about all 
	 * links contained (may contain duplicates!).
	 *
	 * If ignoreSurroundedBy is given, all occurrences which are surrounded by this character will be ignored.
	 */
	static parse(content/*, ignoreSurroundedBy*/) {
		var capturing = false;
		var start = -1;
		var end = -1;
		var coll = [];
		//var hadQuote = false;
		for(var i=0; i<content.length-1; ++i) {
			const cc = content[i] + content[i+1];
			
			if (/*(!capturing) && */(cc == Linkage.startTag)) {
				capturing = true;
				start = i+2;
				
				/*if (ignoreSurroundedBy) {
					if ((i > 0) && (content[i-1] == ignoreSurroundedBy)) {
						hadQuote = true;
					} else {
						hadQuote = false;
					}
				}*/
			}

			if (capturing && (cc == Linkage.endTag)) {
				capturing = false;
				end = i;

				/*if (ignoreSurroundedBy) {
					if (hadQuote && (i < (content.length-2)) && (content[i+2] == ignoreSurroundedBy)) {
						// Already converted link (this is determined by the surrounding quotes)
						continue;
					}
				}*/
				
				coll.push({
					start: start,
					end: end,
					orig: content.substring(start, end),
					link: content.substring(start, end)
				});
			}
		}
		return coll;
	}
}