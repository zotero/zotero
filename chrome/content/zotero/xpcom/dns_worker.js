/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

function getIPForLookup(ip) {
	if (ip.indexOf(".") != -1) {
		// IPv4
		x = ip.split(".").reverse().join(".")+".in-addr.arpa";
	} else {
		if (ip.indexOf("%") != -1) ip = ip.substr(0, ip.indexOf("%"));
		// IPv6
		var parts = ip.split(":");
		x = "ip6.arpa"
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			for (var j = 0; j < (part.length == 0 ? 4*(9-parts.length) : 4-part.length); j++) x = "0." + x;
			for (var j = 0; j < part.length; j++) x = part[j] + "." + x;
		}
	}
	return x;
}

function isLocalIP(ip) {
	return ip.startsWith("169.254.") || ip.startsWith("192.168.") || ip.startsWith("10.") ||
	       /^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(ip) ||
	       ip.startsWith("fe80:") || ip.startsWith("fd00:") || ip == "";
}

onmessage = function (e) {
	var libc, reverseLookup, getIPs, getnameinfo;
	var sockaddr = new ctypes.StructType("sockaddr");
	platform = e.data;

	if (platform == "win") {
		libc = ctypes.open("Ws2_32.dll");
		var addrinfo = new ctypes.StructType("arrinfo");
		addrinfo.define([{"ai_flags":ctypes.int}, {"ai_family":ctypes.int}, {"ai_socktype":ctypes.int},
		                 {"ai_protocol":ctypes.int}, {"ai_addrlen":ctypes.int}, {"ai_canonname":ctypes.char.ptr},
		                 {"ai_addr":sockaddr.ptr}, {"ai_next":addrinfo.ptr}]);
		var gethostname = libc.declare("gethostname", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.size_t);
		var getaddrinfo = libc.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr,
		                               addrinfo.ptr, addrinfo.ptr.ptr);
		var freeaddrinfo = libc.declare("freeaddrinfo", ctypes.default_abi, ctypes.void_t, addrinfo.ptr);
		getnameinfo = libc.declare("getnameinfo", ctypes.default_abi, ctypes.int, sockaddr.ptr, ctypes.int,
		                           ctypes.char.ptr, ctypes.int, ctypes.char.ptr, ctypes.int, ctypes.int);
		getIPs = function () {
			var buf = new new ctypes.ArrayType(ctypes.char, 1025);
			var status = gethostname(buf, 1025);
			if (status != 0) throw new Error("could not get hostname: "+status);

			var ips = [];
			var out = new addrinfo.ptr();
			status = getaddrinfo(buf, null, null, out.address());
			if (status != 0) throw new Error("could not get addrinfo: "+status);
			var rec = out;
			try {
				while (!rec.isNull()) {
					status = getnameinfo(rec.contents.ai_addr, rec.contents.ai_addrlen, buf, 1025, null, 0, 2);
					if (status != 0) throw new Error("could not get IP address: "+status);
					var ip = buf.readString();
					if (!isLocalIP(ip)) ips.push(ip);
					rec = rec.contents.ai_next;
				}
			} finally {
				freeaddrinfo(out);
			}
			return ips;
		};

		var dnsapi = ctypes.open("Dnsapi.dll");
		var DNS_RECORD = new ctypes.StructType("DNS_RECORD");
		DNS_RECORD.define([{"pNext":DNS_RECORD.ptr}, {"pName":ctypes.char.ptr}, {"wType":ctypes.unsigned_short},
		                   {"wDataLength":ctypes.unsigned_short}, {"DW":ctypes.unsigned_long}, {"dwTtl":ctypes.unsigned_long},
		                   {"dwReserved":ctypes.unsigned_long}, {"pNameHost":ctypes.char.ptr}]);
		var DnsQuery = dnsapi.declare("DnsQuery_A", ctypes.winapi_abi, ctypes.int, ctypes.char.ptr, ctypes.unsigned_short,
		                              ctypes.unsigned_long, ctypes.voidptr_t, DNS_RECORD.ptr, ctypes.voidptr_t);
		var DnsRecordListFree = dnsapi.declare("DnsRecordListFree", ctypes.winapi_abi, ctypes.void_t, DNS_RECORD.ptr,
		                                       ctypes.int);
		reverseLookup = function (ip) {
			var record = new DNS_RECORD();
			var status = DnsQuery(getIPForLookup(ip), 12 /*DNS_TYPE_PTR*/, 32 /*DNS_QUERY_NO_LOCAL_NAME*/, null, record.address(), null);
			if (status != 0 || record.pNext.isNull()) return null;
			var retval = record.pNext.contents.pNameHost.readString();
			DnsRecordListFree(record.pNext, 1);
			return retval;
		};
	} else {
		if (platform == "mac") {
			libc = ctypes.open("libc.dylib");
		} else {
			var possibleLibcs = [
				"libc.so.6",
				"libc.so.6.1",
				"libc.so"
			];
			for(var i = 0; i < possibleLibcs.length; i++) {
				try {
					libc = ctypes.open(possibleLibcs[i]);
					break;
				} catch(e) {}
			}
		}

		var AF_INET = 2, AF_INET6, NI_NUMERICHOST, sockaddr_size, libresolv;
		if (platform == "linux") {
			libresolv = ctypes.open("libresolv.so");
			sockaddr.define([{"sa_family":ctypes.unsigned_short}]);
			sockaddrSize = function (x) { return x.sa_family == 10 ? 28 : 16; };
			AF_INET6 = 10;
			NI_NUMERICHOST = 1;
		} else {
			libresolv = libc;
			sockaddr.define([{"sa_len":ctypes.uint8_t}, {"sa_family":ctypes.uint8_t}]);
			sockaddrSize = function (x) { return x.sa_len; };
			AF_INET6 = 30;
			NI_NUMERICHOST = 2;
		}

		var ifaddrs = new ctypes.StructType("ifaddrs");
		ifaddrs.define([{"ifa_next":ifaddrs.ptr}, {"ifa_name":ctypes.char.ptr}, {"ifa_flags":ctypes.unsigned_int},
		                {"ifa_addr":sockaddr.ptr}]);
		var getifaddrs = libc.declare("getifaddrs", ctypes.default_abi, ctypes.int, ifaddrs.ptr.ptr);
		var freeifaddrs = libc.declare("freeifaddrs", ctypes.default_abi, ctypes.void_t, ifaddrs.ptr);
		getnameinfo = libc.declare("getnameinfo", ctypes.default_abi, ctypes.int, sockaddr.ptr, ctypes.int,
		                           ctypes.char.ptr, ctypes.int, ctypes.char.ptr, ctypes.int, ctypes.int);
		getIPs = function () {
			var buf = new new ctypes.ArrayType(ctypes.char, 1025);
			var out = new ifaddrs.ptr();
			var status = getifaddrs(out.address());
			if (status != 0) throw new Error("could not get ifaddrs: "+status);
			var ips = [];
			var rec = out;
			try {
				while (!rec.isNull()) {
					if (!rec.contents.ifa_name.readString().startsWith("lo")) {
						var family = rec.contents.ifa_addr.contents.sa_family;
						if (family == AF_INET || family == AF_INET6) {
							status = getnameinfo(rec.contents.ifa_addr, sockaddrSize(rec.contents.ifa_addr.contents),
								                 buf, 1025, null, 0, NI_NUMERICHOST);
							if (status != 0) throw new Error("could not get IP address: "+status);
							var ip = buf.readString();
							if (!isLocalIP(ip)) ips.push(ip);
						}
					}
					rec = rec.contents.ifa_next;
				}
			} finally {
				freeifaddrs(out);
			}
			return ips;
		};

		var res_query;
		try {
			res_query = libresolv.declare("res_query", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int,
		                                  ctypes.int, ctypes.uint8_t.ptr, ctypes.int);
		} catch(e) {
			res_query = libresolv.declare("__res_query", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int,
		                                  ctypes.int, ctypes.uint8_t.ptr, ctypes.int);
		}
		let response = new new ctypes.ArrayType(ctypes.uint8_t, 1025);
		var skipName = function(response, offset) {
			var len = response[offset++];
			if ((len & 192) == 192) return offset+1; // compressed
			while (len != 0) {
				offset += len;
				len = response[offset++];
			};
			return offset;
		};
		var reverseLookup = function(ip) {
			var len = res_query(getIPForLookup(ip), 1, 12, response, 1025);
			if (len <= 0) return null;

			var offset = 4;
			var qdCount = (response[offset++] << 8) + response[offset++];
			var anCount = (response[offset++] << 8) + response[offset++];
			offset += 4;
			for (var i=0; i<qdCount; i++) {
				offset = skipName(response, offset)+4;
			}
			var domain = [];
			if (anCount >= 1) {
				offset = skipName(response, offset);
				offset += 8;
				var rdLength = (response[offset++] << 8) + response[offset++];       // RDLENGTH
				var endOfData = offset+rdLength;
				while(offset < endOfData) {
					if(offset > endOfData) break;
					var len = response[offset++];
					if(offset+len > endOfData) break;
					var str = "";
					for(var i = 0; i < len; i++) {
						str += String.fromCharCode(response[offset++]);
					}
					domain.push(str);
				}
				domain.pop();
			}
			return domain.join(".")
		};
	}

	var ips = getIPs();
	var hosts = [];
	for (var i = 0; i < ips.length; i++) {
		var host = reverseLookup(ips[i]);
		if(host) hosts.push(host);
	}

	postMessage(hosts);
};