// Firebase Forum & Support Functions
// Add these imports to your app

import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// Assuming you have 'db' and 'auth' initialized from your Firebase config

// ============================================
// FORUM POSTS
// ============================================

// Create a new forum post
export const createForumPost = async (question) => {
  try {
    const docRef = await addDoc(collection(db, 'forum_posts'), {
      question: question,
      author_id: auth.currentUser.uid,
      created_at: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating forum post:', error);
    return { success: false, error: error.message };
  }
};

// Get all forum posts
export const getForumPosts = async () => {
  try {
    const q = query(
      collection(db, 'forum_posts'),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const posts = [];
    querySnapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, posts };
  } catch (error) {
    console.error('Error getting forum posts:', error);
    return { success: false, error: error.message };
  }
};

// Update a forum post (owner only)
export const updateForumPost = async (postId, newQuestion) => {
  try {
    await updateDoc(doc(db, 'forum_posts', postId), {
      question: newQuestion
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating forum post:', error);
    return { success: false, error: error.message };
  }
};

// Delete a forum post (owner only)
export const deleteForumPost = async (postId) => {
  try {
    await deleteDoc(doc(db, 'forum_posts', postId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting forum post:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// FORUM ANSWERS
// ============================================

// Create a new answer to a forum post
export const createForumAnswer = async (postId, answerText) => {
  try {
    const docRef = await addDoc(collection(db, 'forum_answers'), {
      post_id: postId,
      text: answerText,
      author_id: auth.currentUser.uid,
      created_at: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating forum answer:', error);
    return { success: false, error: error.message };
  }
};

// Get all answers for a specific post
export const getForumAnswers = async (postId) => {
  try {
    const q = query(
      collection(db, 'forum_answers'),
      where('post_id', '==', postId),
      orderBy('created_at', 'asc')
    );
    const querySnapshot = await getDocs(q);
    
    const answers = [];
    querySnapshot.forEach((doc) => {
      answers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, answers };
  } catch (error) {
    console.error('Error getting forum answers:', error);
    return { success: false, error: error.message };
  }
};

// Update a forum answer (owner only)
export const updateForumAnswer = async (answerId, newText) => {
  try {
    await updateDoc(doc(db, 'forum_answers', answerId), {
      text: newText
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating forum answer:', error);
    return { success: false, error: error.message };
  }
};

// Delete a forum answer (owner only)
export const deleteForumAnswer = async (answerId) => {
  try {
    await deleteDoc(doc(db, 'forum_answers', answerId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting forum answer:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SUPPORT REQUESTS
// ============================================

// Create a support request
export const createSupportRequest = async (message) => {
  try {
    const docRef = await addDoc(collection(db, 'support_requests'), {
      user_id: auth.currentUser.uid,
      message: message,
      created_at: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating support request:', error);
    return { success: false, error: error.message };
  }
};

// Get all support requests (admin only)
export const getSupportRequests = async () => {
  try {
    const q = query(
      collection(db, 'support_requests'),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, requests };
  } catch (error) {
    console.error('Error getting support requests:', error);
    return { success: false, error: error.message };
  }
};

// Update a support request (admin only)
export const updateSupportRequest = async (requestId, updates) => {
  try {
    await updateDoc(doc(db, 'support_requests', requestId), updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating support request:', error);
    return { success: false, error: error.message };
  }
};

// Delete a support request (admin only)
export const deleteSupportRequest = async (requestId) => {
  try {
    await deleteDoc(doc(db, 'support_requests', requestId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting support request:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// ADMIN ROLE MANAGEMENT
// ============================================

// Set a user as admin (you'll need to run this manually for the first admin)
export const setUserAsAdmin = async (userId) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      role: 'admin'
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error setting admin role:', error);
    return { success: false, error: error.message };
  }
};

// Check if current user is admin
export const isCurrentUserAdmin = async () => {
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      return userDoc.data().role === 'admin';
    }
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// ============================================
// EXAMPLE USAGE
// ============================================

/*
// Create a forum post
const result = await createForumPost('How do I upgrade to Premium?');
if (result.success) {
  console.log('Post created with ID:', result.id);
}

// Get all forum posts
const postsResult = await getForumPosts();
if (postsResult.success) {
  console.log('Posts:', postsResult.posts);
}

// Create an answer
const answerResult = await createForumAnswer(postId, 'Click Upgrade in Settings');
if (answerResult.success) {
  console.log('Answer created!');
}

// Get answers for a post
const answersResult = await getForumAnswers(postId);
if (answersResult.success) {
  console.log('Answers:', answersResult.answers);
}

// Create a support request
const supportResult = await createSupportRequest('I need help with my account');
if (supportResult.success) {
  console.log('Support request created!');
}

// Admin: Get all support requests
const requestsResult = await getSupportRequests();
if (requestsResult.success) {
  console.log('Support requests:', requestsResult.requests);
}
*/
