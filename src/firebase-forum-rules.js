// Firebase Firestore Security Rules for Forum and Support
// Copy this into Firebase Console → Firestore Database → Rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user is admin
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user owns the document
    function isOwner(authorId) {
      return isAuthenticated() && request.auth.uid == authorId;
    }
    
    // FORUM POSTS
    match /forum_posts/{postId} {
      // Anyone can read forum posts
      allow read: if true;
      
      // Authenticated users can create posts (with their own author_id)
      allow create: if isAuthenticated() && 
                       request.resource.data.author_id == request.auth.uid;
      
      // Only the author can update their own post
      allow update: if isOwner(resource.data.author_id) &&
                       request.resource.data.author_id == request.auth.uid;
      
      // Only the author can delete their own post
      allow delete: if isOwner(resource.data.author_id);
    }
    
    // FORUM ANSWERS
    match /forum_answers/{answerId} {
      // Anyone can read forum answers
      allow read: if true;
      
      // Authenticated users can create answers (with their own author_id)
      allow create: if isAuthenticated() && 
                       request.resource.data.author_id == request.auth.uid;
      
      // Only the author can update their own answer
      allow update: if isOwner(resource.data.author_id) &&
                       request.resource.data.author_id == request.auth.uid;
      
      // Only the author can delete their own answer
      allow delete: if isOwner(resource.data.author_id);
    }
    
    // SUPPORT REQUESTS
    match /support_requests/{requestId} {
      // Only admins can read support requests
      allow read: if isAdmin();
      
      // Authenticated users can create support requests (with their own user_id)
      allow create: if isAuthenticated() && 
                       request.resource.data.user_id == request.auth.uid;
      
      // Only admins can update support requests
      allow update: if isAdmin();
      
      // Only admins can delete support requests
      allow delete: if isAdmin();
    }
    
    // USERS collection (needed for admin role checking)
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && userId == request.auth.uid;
    }
  }
}
