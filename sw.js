'use strict';
importScripts('./js/idb.js');
importScripts('./js/dbhelper.js');


/**
* Service worker
*/
const CACHE_NAME = 'project-stage3-cache-v1';
const ImgsCache = 'project-stage3-cache-imgs';
const allCaches = [CACHE_NAME, ImgsCache];
const urlsToCache = [
	'/',
	'/index.html',
	'/restaurant.html',
	'/form.html',
	'/css/styles.min.css',
	'/js/main.js',
	'/js/dbhelper.js',
	'/js/restaurant_info.js',
	'/js/idb.js'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

function syncReview () {
	//Background sync handler
	var db = idb.open('projphase3', 1);
	
		db.then(db => {
		console.log('Open DB was hit while offline');
		var tx = db.transaction(['tempReviewList'], 'readonly');
		var store = tx.objectStore('tempReviewList');
		var ar = store.getAll();
		return ar;
		})
		.then((ar) => {
			if(ar.length > 0){
				ar.forEach ( (a) => {
					console.log(a);
					fetch(DBHelper.SERVER_URL+`/reviews`,{method: 'POST', body: JSON.stringify(a), headers:{'content-type': 'application/json'}})
					.then(response => {if(response.ok === true){
						console.log(response.text());
					}});
				});
		}})
		.catch(error => console.log(error));
		//clear records from temporary object store when going online
		db.then(db => {
			var tx = db.transaction(['tempReviewList'], 'readwrite');
			var store = tx.objectStore('tempReviewList');
			store.clear();
		});	
}

self.addEventListener('sync', function(event) {
  if (event.tag == 'bkgSync') {
	console.log('SYNC event fired!');  
    event.waitUntil(syncReview());
  }
});

async function createDB(){
	//Create indexedDB projphase3 and object stores
	var db = idb.open('projphase3', 1, upgradeDb => {
		if(!upgradeDb.objectStoreNames.contains('restaurantList')||!upgradeDb.objectStoreNames.contains('reviewList')||!upgradeDb.objectStoreNames.contains('tempReviewList')) {
			upgradeDb.createObjectStore('restaurantList', {keyPath: 'id'});
			upgradeDb.createObjectStore('reviewList', {keyPath: 'id'});
			upgradeDb.createObjectStore('tempReviewList', { autoIncrement : true });
		}
	});

	let restaurants = await fetch(DBHelper.DATABASE_URL)
		.then((response)=>{if (response.ok){return response.text()}})
		.then((text)=>{let feeder = JSON.parse(text); return feeder;});
	
	restaurants.forEach( async function(restaurant) {
		let reviews = await fetch(DBHelper.DATABASE_REVIEWS_URL+`${restaurant.id}`)
			.then((response)=>{if (response.ok){return response.text()}})
			.then((text)=>{let feeder = JSON.parse(text); return feeder;});
		
		db.then((db) => {
		var tx = db.transaction(['restaurantList'], 'readwrite');
			return tx;
		})
		.then((tx) => {
			var store = tx.objectStore('restaurantList');
			return store;
		})
		.then((store) => {
			store.put(restaurant); 
		});
		
		db.then((db) => {
		var tx = db.transaction(['reviewList'], 'readwrite');
			return tx;
		})
		.then((tx) => {
			var store = tx.objectStore('reviewList');
			return store;
		})
		.then((store) => {
			reviews.forEach(review =>{
				store.put(review); 
			});
		});
	
	});	
}
self.addEventListener('activate', event => {
	event.waitUntil(createDB());
	console.log('DB was created in sw');
});
 
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('project-stage3-') &&
                 !allCaches.includes(cacheName);
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {

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
	caches.match(event.request).then(response => {
	  return response || fetch(event.request);
	})
	);
});

function servePhoto(request) {
  var storageUrl = request.url.replace(/-\d+px\.jpg$/, '');
	
  return caches.open(ImgsCache).then(cache => {
    return cache.match(storageUrl).then(response => {
      if (response) {
		  return response;
	  }
      return fetch(request).then(networkResponse => {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}