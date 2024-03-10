const clientId = 'changethat';
const redirectUri = 'http://localhost:8080';
const scopes = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing user-top-read';

var accessToken = '';


function authorize() {
  const authorizeUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token`;
  window.location.href = authorizeUrl;
}

function updateCurrentPlaying(trackName, imageUrl) {
  const currentPlayingElement = document.getElementById('current-playing');
  const currentPlayingCoverElememt = document.getElementById('current-playing-cover');
  if (currentPlayingElement) {
    currentPlayingElement.textContent = trackName;
  }

  if (currentPlayingCoverElememt) {
    currentPlayingCoverElememt.src = imageUrl;
  }
}

function updatePodio(trackName, imageUrl, podioNumber) {
  const podioTitle = document.getElementById(`podio-${podioNumber}-title`);
  const podioCover = document.getElementById(`podio-${podioNumber}-cover`);
  if (podioTitle) {
    podioTitle.textContent = trackName;
  }

  if (podioCover) {
    podioCover.src = imageUrl;
  }
}

function fetchItemDetails(itemUri, accessToken) {
  const parts = itemUri.split(':');
  const type = parts[1];
  const id = parts[2];
  let apiUrl;

  if (type === 'track') {
    apiUrl = `https://api.spotify.com/v1/tracks/${id}`;
  } else if (type === 'album') {
    apiUrl = `https://api.spotify.com/v1/albums/${id}`;
  } else if (type === 'playlist') {
    apiUrl = `https://api.spotify.com/v1/playlists/${id}`;
  } else {
    console.error('Unsupported item type:', type);
    return Promise.reject(new Error('Unsupported item type'));
  }

  return fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Response not OK');
      }
    })
    .catch(error => {
      console.error('Error fetching item details:', error);
      return {};
    });
}

function fetchTopPlaysAndDetails() {
  fetch('http://localhost:8888/top-plays')
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Response not OK');
      }
    })
    .then(data => {
      console.log(data);
      const itemURIs = Object.keys(data);
      const promises = itemURIs.map((itemUri, index) => {
        return fetchItemDetails(itemUri, accessToken)
          .then(itemDetails => {
            const trackName = itemDetails.name || 'None';
            var images = [];
            if (itemDetails.album) {
              images = itemDetails.album.images;
            } else {
              images = itemDetails.images;
            }
            const imageUrl = images.length > 0 ? images[0].url : 'assets/images/clara.svg';
            updatePodio(trackName, imageUrl, index + 1);
          });
      });
      return Promise.all(promises);
    })
    .catch(error => {
      console.error('Error fetching top plays:', error);
    });
}

function fetchCurrentPlaying(event) {
  const lastPlayedItemUri = event.data;
  console.log("LAST PLAYED", lastPlayedItemUri);
  fetchItemDetails(lastPlayedItemUri, accessToken).then(itemDetails => {
    const trackName = itemDetails.name || 'None';
    var images = [];
    if (itemDetails.album) {
      images = itemDetails.album.images;
    } else {
      images = itemDetails.images;
    }
    const imageUrl = images.length > 0 ? images[0].url : 'assets/images/clara.svg';
    console.log("itemdetails", itemDetails);
    updateCurrentPlaying(trackName, imageUrl);
  })
}

const ws = new WebSocket('ws://localhost:8000');

ws.onopen = function () {
  console.log('Connected to WebSocket server');
};

ws.onmessage = function (event) {
  fetchCurrentPlaying(event);
  fetchTopPlaysAndDetails();
};

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.hash.substring(1));
  accessToken = params.get('access_token');

  if (accessToken) {
    console.log("Authenticado")
  } else {
    authorize();
  }
});
