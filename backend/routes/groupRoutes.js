import express from 'express';
import {
  createGroup,
  listGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  inviteUser,
  acceptInvitation,
  rejectInvitation,
  listPendingInvitations
} from '../controllers/groupController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All group routes are protected

// Core group endpoints
router.post('/', createGroup);
router.get('/', listGroups);
router.get('/:id', getGroupDetails);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

// Invitation endpoints
router.post('/:id/invite', inviteUser);
router.get('/invitations/pending', listPendingInvitations);
router.post('/invitations/:id/accept', acceptInvitation);
router.post('/invitations/:id/reject', rejectInvitation);

export default router;
