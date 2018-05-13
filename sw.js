'use strict';
importScripts('./js/idb.js');
importScripts('./js/dbhelper.js');

/**
* Service worker
*/
var CACHE_NAME = 'project-stage2-cache-v1';
var ImgsCache = 'project-stage2-cache-imgs';
var allCaches = [CACHE_NAME, ImgsCache];
var urlsToCache = [
	'/',
	'/index.html',
	'/restaurant.html',
	'/css/styles.css',
	'/js/main.js',
	'/js/dbhelper.js',
	'/js/idb.js'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

function createDB(){
	fetch(DBHelper.DATABASE_URL).then((response)=>{if (response.ok){return response.text()}}).then((text)=>{let feeder = JSON.parse(text); return feeder;}).then(feeder => {
		idb.open('projphase2', 1, function(upgradeDb) {
			if (!upgradeDb.objectStoreNames.contains('restaurantList')) {
				const restaurants = upgradeDb.createObjectStore('restaurantList', {keyPath: 'id'});
				feeder.forEach(function(restaurant){
				restaurants.put(restaurant); 
				});
			}
		})
	});
}

self.addEventListener('activate', event => {
	event.waitUntil(createDB());
	console.log('DB was created in sw');
})
 
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('project-stage2-') &&
                 !allCaches.includes(cacheName);
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);
	
  if (requestUrl.origin === location.origin) {
	if (requestUrl.pathname === '/') {
	  event.respondWith(caches.match('/index.html'));
	  return;
  }}
	if (requestUrl.pathname.startsWith('/img/')) {
	  event.respondWith(servePhoto(event.request));
	  return;
	}
	
	if (requestUrl.pathname.startsWith('/restaurant.html')) {
	  event.respondWith(caches.match('/restaurant.html'));
	  return;
	}
	
	if (requestUrl.pathname === '/restaurants') {
	  return fetch(event.request);
	}

  event.respondWith(
	caches.match(event.request).then(function(response) {
	  return response || fetch(event.request);
	})
	);
});

function servePhoto(request) {
  var storageUrl = request.url.replace(/-\d+px\.jpg$/, '');
	
  return caches.open(ImgsCache).then(function(cache) {
    return cache.match(storageUrl).then(function(response) {
      if (response) {
		  return response;
	  }
      return fetch(request).then(function(networkResponse) {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}