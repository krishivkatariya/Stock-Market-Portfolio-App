const express = require('express');
const { getIpos, getIpoById } = require('../controllers/ipoController');

const router = express.Router();

router.get('/', getIpos);
router.get('/upcoming', (req, res, next) => {
  req.query.status = 'UPCOMING';
  next();
}, getIpos);
router.get('/open', (req, res, next) => {
  req.query.status = 'OPEN';
  next();
}, getIpos);
router.get('/closed', (req, res, next) => {
  req.query.status = 'CLOSED';
  next();
}, getIpos);
router.get('/listed', (req, res, next) => {
  req.query.status = 'LISTED';
  next();
}, getIpos);
router.get('/:id', getIpoById);

module.exports = router;
