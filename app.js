const express = require('express');
const request = require('request');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();


const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URL;
const stateKey = 'spotify_auth_state';

const idCounts = {};

const app = express();

const corsOptions = {
    origin: '*',
    credentials: true,
};

app.use(cors(corsOptions));


app.use(express.static(__dirname + '/public'));

app.use(cookieParser());

app.use(session({
    secret: 'your_secret_key',
    resave: true,
    saveUninitialized: true
}));

app.get('/', (req, res) => {
    res.redirect('/current-playing');
});


app.get('/current-playing', (req, res) => {
    if (!req.session.access_token) {
        const state = generateRandomString(16);
        req.session[stateKey] = state;

        const scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing user-top-read';
        const authUrl = 'https://accounts.spotify.com/authorize?' +
            querystring.stringify({
                response_type: 'code',
                client_id: client_id,
                scope: scope,
                redirect_uri: redirect_uri,
                state: state
            });

        return res.redirect(authUrl);
    }

    const access_token = req.session.access_token;
    const options = {
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    request.get(options, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            if (body) {
                res.send(body);
            }
        } else if (!error && response.statusCode === 204) {
            res.send({ current_playing: "None" })
        } else {
            res.status(response.statusCode).send({ error: 'Failed to fetch currently playing track' });
        }
    });
});

app.get('/count-plays', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    idCounts[id] = (idCounts[id] || 0) + 1;
    res.json({ [id]: idCounts[id] });
});

app.get('/top-plays', (req, res) => {
    const sortedIdCounts = Object.entries(idCounts).sort((a, b) => b[1] - a[1]);
    const slicedEntries = sortedIdCounts.slice(0, 3);
    const slicedCountsObject = Object.fromEntries(slicedEntries);

    res.json(slicedCountsObject);
});



app.get('/get-count', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    res.json({ [id]: idCounts[id] });
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.session[stateKey];

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        delete req.session[stateKey];
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
            },
            json: true
        };

        request.post(authOptions, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                req.session.access_token = body.access_token;
                const redirectUrl = req.session.returnTo || '/';
                res.redirect(redirectUrl);
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}
