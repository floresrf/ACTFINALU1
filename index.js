//http://localhost:3000/list-files?token=
const { google } = require('googleapis');
const express = require('express');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // Carga variables de entorno desde un archivo .env

console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('CLIENT_SECRET:', process.env.CLIENT_SECRET);
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// const oauth2Client = new google.auth.OAuth2(
//     '634690559909-h4lcl1knhpbe0julb6sl91dma11qouc8.apps.googleusercontent.com', // Tu Client ID
//     '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', // Tu Client Secret
//     'http://localhost:3000/oauth2callback' // URI de redirección
// );

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID, // Se cambió el ID del cliente a una variable de entorno
    process.env.CLIENT_SECRET, // Se cambió el Secret a una variable de entorno
    'http://localhost:3000/oauth2callback'
);


// Ruta para servir el archivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para autenticación
app.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive.metadata.readonly'], // Permisos básicos
    });
    res.redirect(authUrl);
});

// Ruta para manejar el callback de OAuth2
app.get('/oauth2callback', async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code); // Intercambiar el código por un token
        oauth2Client.setCredentials(tokens);

        // Obtener información del usuario autenticado
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2',
        });
        const userInfo = await oauth2.userinfo.get();

        // Se agregó la generación de JWT con los datos del usuario
        const token = jwt.sign({ email: userInfo.data.email, name: userInfo.data.name }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.send(`
            <h1>Inicio de sesión exitoso</h1>
            <p><strong>Correo:</strong> ${userInfo.data.email}</p>
            <p><strong>Nombre:</strong> ${userInfo.data.name}</p>
            <p>Tu token JWT: <code>${token}</code></p>
            <button onclick="window.location.href='/list-files'">Log In con Google</button>
        `);
    } catch (error) {
        res.status(500).send('Error durante la autenticación: ' + error.message);
    }
});
//Middleware para verificar JWT
function verificarToken(req, res, next) {
    const token = req.query.token || req.headers['authorization']; // Obtiene el token de la URL
    if (!token) return res.status(403).send('Acceso denegado'); // Si no hay token, se bloquea el acceso

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { 
    if (err) return res.status(401).send('Token inválido');// Si el token es incorrecto, devuelve error
        req.user = decoded; // Adjunta los datos del usuario autenticado a la petición
        next(); // Llama a la siguiente función
    });
}
app.get('/list-files', verificarToken, async (req, res) => {
    // Esta ruta ahora solo puede ser accedida si se proporciona un JWT válido
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Solicitar los primeros 10 archivos del Drive del usuario
        const response = await drive.files.list({
            pageSize: 10,
            fields: 'files(id, name)', // Especificar los campos que queremos recibir
        });

        const files = response.data.files;

        if (files.length === 0) {
            res.send('<h1>No se encontraron archivos en Google Drive</h1>');
        } else {
            let fileList = '<h1>Archivos en tu Google Drive:</h1><ul>';
            files.forEach(file => {
                fileList += `<li>${file.name} (ID: ${file.id})</li>`;
            });
            fileList += '</ul>';
            res.send(fileList);
        }
    } catch (error) {
        res.status(500).send('Error al listar archivos: ' + error.message);
    }
});

// Iniciar el servidor
app.listen(3000, () => console.log('Servidor ejecutándose en http://localhost:3000'));