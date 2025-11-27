import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import Note from "../views/Note.vue";
import Login from "../views/Login.vue";
import Register from "../views/Register.vue";
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true } // ✅ Route protégée : nécessite une authentification
  },
  {
    path: '/note',
    name: 'Note',
    component: Note,
    meta: { requiresAuth: true } // ✅ Route protégée
  },
  {
    path: '/about',
    name: 'About',
    component: About,
    meta: { requiresAuth: true } // ✅ Route protégée
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false } // ✅ Route publique (accessible sans authentification)
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresAuth: false } // ✅ Route publique
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ─── Navigation Guard : Vérifie l'authentification avant chaque navigation ────────
// Un navigation guard s'exécute avant chaque changement de route
// - to : La route vers laquelle on navigue
// - from : La route d'où on vient
// - next : Fonction pour continuer la navigation (ou rediriger)
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Si la route nécessite une authentification
  if (to.meta.requiresAuth) {
    // Vérifier si l'utilisateur est connecté
    if (!authStore.isAuthenticated) {
      // Si non connecté, rediriger vers la page de login
      // - query.redirect : Sauvegarde l'URL de destination pour y rediriger après login
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      // Si connecté, autoriser l'accès à la route
      next();
    }
  } else {
    // Si la route est publique (login, register), vérifier si déjà connecté
    if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
      // Si déjà connecté et qu'on essaie d'accéder à login/register, rediriger vers l'accueil
      next('/');
    } else {
      // Sinon, autoriser l'accès
      next();
    }
  }
});

export default router
