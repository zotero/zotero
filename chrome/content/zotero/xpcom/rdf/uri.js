//  Implementing URI-specific functions
//
//	See RFC 2386
//
// This is or was   http://www.w3.org/2005/10/ajaw/uri.js
// 2005 W3C open source licence
//
//
//  Take a URI given in relative or absolute form and a base
//  URI, and return an absolute URI
//
//  See also http://www.w3.org/2000/10/swap/uripath.py
//
if(typeof $rdf.Util.uri == "undefined") {
  $rdf.Util.uri = {};
};

$rdf.Util.uri.join = function (given, base) {
  // if (typeof $rdf.log.debug != 'undefined') $rdf.log.debug("   URI given="+given+" base="+base)
  var baseHash = base.indexOf('#')
  if(baseHash > 0) base = base.slice(0, baseHash)
  if(given.length == 0) return base // before chopping its filename off
  if(given.indexOf('#') == 0) return base + given
  var colon = given.indexOf(':')
  if(colon >= 0) return given // Absolute URI form overrides base URI
  var baseColon = base.indexOf(':')
  if(base == "") return given;
  if(baseColon < 0) {
    alert("Invalid base: " + base + ' in join with ' + given);
    return given
  }
  var baseScheme = base.slice(0, baseColon + 1) // eg http:
  if(given.indexOf("//") == 0) // Starts with //
  return baseScheme + given;
  if(base.indexOf('//', baseColon) == baseColon + 1) { // Any hostpart?
    var baseSingle = base.indexOf("/", baseColon + 3)
    if(baseSingle < 0) {
      if(base.length - baseColon - 3 > 0) {
        return base + "/" + given
      } else {
        return baseScheme + given
      }
    }
  } else {
    var baseSingle = base.indexOf("/", baseColon + 1)
    if(baseSingle < 0) {
      if(base.length - baseColon - 1 > 0) {
        return base + "/" + given
      } else {
        return baseScheme + given
      }
    }
  }

  if(given.indexOf('/') == 0) // starts with / but not //
  return base.slice(0, baseSingle) + given

  var path = base.slice(baseSingle)
  var lastSlash = path.lastIndexOf("/")
  if(lastSlash < 0) return baseScheme + given
  if((lastSlash >= 0)
    && (lastSlash < (path.length - 1)))
    path = path.slice(0, lastSlash + 1) // Chop trailing filename from base
  path = path + given
  while(path.match(/[^\/]*\/\.\.\//)) // must apply to result of prev
  path = path.replace(/[^\/]*\/\.\.\//, '') // ECMAscript spec 7.8.5
  path = path.replace(/\.\//g, '') // spec vague on escaping
  path = path.replace(/\/\.$/, '/')
  return base.slice(0, baseSingle) + path
}

if(typeof tabulator != 'undefined' && tabulator.isExtension) {
  $rdf.Util.uri.join2 = function (given, base) {
    var tIOService = Components.classes['@mozilla.org/network/io-service;1']
      .getService(Components.interfaces.nsIIOService);

    var baseURI = tIOService.newURI(base, null, null);
    return tIOService.newURI(baseURI.resolve(given), null, null).spec;
  }
} else
  $rdf.Util.uri.join2 = $rdf.Util.uri.join;

//  refTo:    Make a URI relative to a given base
//
// based on code in http://www.w3.org/2000/10/swap/uripath.py
//
$rdf.Util.uri.commonHost = new RegExp("^[-_a-zA-Z0-9.]+:(//[^/]*)?/[^/]*$");

$rdf.Util.uri.hostpart = function (u) {
  var m = /[^\/]*\/\/([^\/]*)\//.exec(u);
  return m ? m[1] : ''
};

$rdf.Util.uri.refTo = function (base, uri) {
  if(!base) return uri;
  if(base == uri) return "";
  var i = 0; // How much are they identical?
  while(i < uri.length && i < base.length)
  if(uri[i] == base[i]) i++;
  else break;
  if(base.slice(0, i).match($rdf.Util.uri.commonHost)) {
    var k = uri.indexOf('//');
    if(k < 0) k = -2; // no host
    var l = uri.indexOf('/', k + 2); // First *single* slash
    if(uri.slice(l + 1, l + 2) != '/'
      && base.slice(l + 1, l + 2) != '/'
      && uri.slice(0, l) == base.slice(0, l))
      // common path to single slash
      return uri.slice(l); // but no other common path segments
  }
  // fragment of base?
  if(uri.slice(i, i + 1) == '#' && base.length == i) return uri.slice(i);
  while(i > 0 && uri[i - 1] != '/') i--;

  if(i < 3) return uri; // No way
  if((base.indexOf('//', i - 2) > 0)
    || uri.indexOf('//', i - 2) > 0)
    return uri; // an unshared '//'
  if(base.indexOf(':', i) > 0) return uri; // unshared ':'
  var n = 0;
  for(var j = i; j < base.length; j++) if(base[j] == '/') n++;
  if(n == 0 && i < uri.length && uri[i] == '#') return './' + uri.slice(i);
  if(n == 0 && i == uri.length) return './';
  var str = '';
  for(var j = 0; j < n; j++) str += '../';
  return str + uri.slice(i);
}


/** returns URI without the frag **/
$rdf.Util.uri.docpart = function (uri) {
  var i = uri.indexOf("#")
  if(i < 0) return uri
  return uri.slice(0, i)
}

/** The document in which something a thing defined  **/
$rdf.Util.uri.document = function (x) {
  return $rdf.sym($rdf.Util.uri.docpart(x.uri));
}

/** return the protocol of a uri **/
/** return null if there isn't one **/
$rdf.Util.uri.protocol = function (uri) {
  var index = uri.indexOf(':');
  if(index >= 0) return uri.slice(0, index);
  else return null;
} //protocol
//ends