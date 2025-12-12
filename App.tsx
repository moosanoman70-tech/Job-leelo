
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Briefcase, FileText, PlusCircle, Search, Map as MapIcon, List, User, CheckCircle, ShieldAlert, ArrowRight, ArrowLeft, Send, Download, Loader2, Navigation2, Crosshair, Filter, X, GraduationCap, Zap, Clock, Phone, Mail, Home, Globe, Heart, Save, Tablet, Smartphone, Video, PlayCircle, BarChart, Users, Star, Bell, Moon, Sun, Check, Award, ChevronDown, Clock3 } from 'lucide-react';
import { Job, Language, ScreenName, UserProfile, JobType, FilterState, Course, AppliedJob } from './types';
import { MOCK_JOBS, TRANSLATIONS, JOB_CATEGORIES, CITY_COORDINATES, MOCK_COURSES, MOCK_APPLICANTS } from './constants';
import { generateCVContent, rankJobsWithAI } from './services/geminiService';
import { Button } from './components/Button';

// Declare Leaflet globally since we loaded it via script tag
declare const L: any;

// --- Sub-components for Screens ---

const JobCard: React.FC<{ job: Job; onClick: () => void; t: any; isCompact?: boolean }> = ({ job, onClick, t, isCompact = false }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98] duration-200 ${isCompact ? 'p-3' : 'p-4 mb-3'}`}>
    <div className="flex justify-between items-start">
      <div>
        <h3 className={`font-bold text-gray-900 dark:text-white ${isCompact ? 'text-sm' : 'text-lg'}`}>{job.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
          <Briefcase size={12} /> {job.company}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
         {job.isPremium && (
          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider">
            <Star size={8} fill="currentColor" /> {t.premium}
          </span>
        )}
        {job.isVerified && (
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
            <CheckCircle size={10} /> {t.verified}
          </span>
        )}
      </div>
    </div>
    
    <div className={`flex items-center gap-2 mt-3 text-sm text-gray-600 dark:text-gray-300 ${isCompact ? 'flex-col items-start gap-1' : ''}`}>
      <span className="flex items-center gap-1 bg-gray-50 dark:bg-slate-700 px-2 py-1 rounded">
        <MapPin size={12} className="text-brand-500" /> {job.locationName}
      </span>
      <span className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded font-medium">
        {job.salary.replace('PKR ', 'Rs. ')}
      </span>
    </div>

    {!isCompact && (
       <div className="mt-3 text-xs text-gray-400 flex justify-between items-center">
         <span>{job.type}</span>
         <span>{job.postedAt}</span>
       </div>
    )}
  </div>
);

// --- Helper Functions ---

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

// --- Main App Component ---

const App: React.FC = () => {
  // State
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('onboarding');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // City Selector State
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);

  // App Modes & Features
  const [isEmployerMode, setIsEmployerMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // New State for Location Name
  const [currentMapLocationName, setCurrentMapLocationName] = useState<string>('Pakistan');

  // Tablet Mode State
  const [isTabletMode, setIsTabletMode] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    onlyPartTime: false,
    minSalary: 0,
    onlyNearMe: false
  });

  const mapRef = useRef<any>(null); 
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    phone: '',
    email: '',
    gender: 'Male',
    age: '',
    city: '',
    address: '',
    educationLevel: 'None',
    languages: [],
    categoryPreference: '',
    skills: [],
    experience: '',
    education: '',
    preferredSalary: '',
    shiftPreference: 'Morning',
    hasTransport: false,
    isVerified: false,
    hasVideoResume: false
  });

  // Jobs Applied State
  const [myAppliedJobs, setMyAppliedJobs] = useState<AppliedJob[]>([]);

  // AI Match Results
  const [aiMatches, setAiMatches] = useState<{jobId: string, reason: string}[]>([]);
  // CV Builder State
  const [generatedCV, setGeneratedCV] = useState<string>('');

  const t = TRANSLATIONS[language];
  const isUrdu = language === Language.URDU;

  // Toggle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Detect City Function
  const detectCity = (lat: number, lng: number) => {
    let closestCity = t.pakistan;
    let minDistance = 50; // Max radius to consider "in a city" (km)

    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
      const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestCity = coords.label;
      }
    }
    setCurrentMapLocationName(closestCity);
  };

  const handleCitySelect = (cityKey: string) => {
    const city = CITY_COORDINATES[cityKey];
    if (city && mapRef.current) {
      mapRef.current.flyTo([city.lat, city.lng], 13, { animate: true, duration: 1.5 });
      setCurrentMapLocationName(city.label);
      setIsCitySelectorOpen(false);
    }
  };

  // Filter Jobs Logic
  const filteredJobs = useMemo(() => {
    return MOCK_JOBS.filter(job => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
          job.title.toLowerCase().includes(q) || 
          job.company.toLowerCase().includes(q) || 
          job.locationName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Category
      if (filters.category !== 'All' && job.category !== filters.category) {
        return false;
      }

      // 3. Part Time
      if (filters.onlyPartTime && job.type !== JobType.PART_TIME) {
        return false;
      }

      // 4. Min Salary
      const jobSalary = parseInt(job.salary.replace(/[^0-9]/g, '')) || 0;
      if (filters.minSalary > 0 && jobSalary < filters.minSalary) {
        return false;
      }

      // 5. Near Me (< 5km)
      if (filters.onlyNearMe && userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, job.lat, job.lng);
        if (dist > 5) return false;
      }

      return true;
    });
  }, [searchQuery, filters, userLocation]);

  // Handle Tablet Mode Map Resize
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 400); // Wait for transition
    }
  }, [isTabletMode]);

  // Initialize Map
  useEffect(() => {
    if (currentScreen === 'home' && mapContainerRef.current && !mapRef.current) {
      const defaultCenter = [30.3753, 69.3451]; 
      
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(defaultCenter, 6);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapRef.current);

      const southWest = L.latLng(20.0000, 60.0000);
      const northEast = L.latLng(38.0000, 80.0000);
      const bounds = L.latLngBounds(southWest, northEast);
      
      mapRef.current.setMaxBounds(bounds);
      mapRef.current.setMinZoom(5);

      L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current);

      mapRef.current.on('moveend', () => {
        const center = mapRef.current.getCenter();
        detectCity(center.lat, center.lng);
      });
    }
  }, [currentScreen]);

  // Real-time Geolocation
  useEffect(() => {
    if (navigator.geolocation && (currentScreen === 'home' || currentScreen === 'profileSetup')) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          if (!hasCentered && mapRef.current && currentScreen === 'home') {
            mapRef.current.flyTo([latitude, longitude], 14, { animate: true, duration: 1.5 });
            setHasCentered(true);
            detectCity(latitude, longitude);
          }
        },
        (error) => console.log('Geolocation denied/error', error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(id);
    }
  }, [currentScreen, hasCentered]);

  // Update Map Markers based on Filtered Jobs
  useEffect(() => {
    if (!mapRef.current || currentScreen !== 'home') return;

    // Global listener for popup clicks
    const handlePopupAction = (e: MouseEvent) => {
       const target = e.target as HTMLElement;
       if (target && target.id && target.id.startsWith('btn-job-')) {
          const jobId = target.id.replace('btn-job-', '');
          const job = filteredJobs.find(j => j.id === jobId);
          if (job) {
             setSelectedJob(job);
          }
       }
    };
    
    const mapContainer = mapContainerRef.current;
    if (mapContainer) {
       mapContainer.addEventListener('click', handlePopupAction);
    }

    // Clear existing markers
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    // Add Filtered Job Markers
    filteredJobs.forEach(job => {
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="custom-marker-label animate-pop-in ${job.isPremium ? 'border-amber-400 border-2' : ''}">
             ${job.isPremium ? '<div class="absolute -top-2 -right-2 text-amber-500"><svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>' : ''}
             <div class="font-bold text-xs text-brand-700 leading-tight mb-0.5 whitespace-normal">${job.title}</div>
             <div class="text-[10px] text-gray-600 truncate w-full border-t border-gray-100 mt-1 pt-0.5">${job.locationName}</div>
             <div class="text-[10px] font-bold text-green-600">${job.salary.replace('PKR ', '')}</div>
          </div>
        `,
        iconSize: [140, 60],
        iconAnchor: [70, 60]
      });

      const popupHTML = `
        <div class="flex flex-col p-3 bg-white min-w-[160px] font-sans">
           <div class="font-bold text-gray-900 text-sm mb-0.5 leading-tight">${job.title}</div>
           <div class="text-xs text-gray-500 mb-2">${job.company}</div>
           <div class="font-bold text-green-600 text-sm mb-3">${job.salary}</div>
           <button id="btn-job-${job.id}" class="bg-brand-600 text-white text-xs font-bold py-2 px-3 rounded-lg hover:bg-brand-700 active:scale-95 transition-transform w-full shadow-sm">
             ${t.jobDetails || 'View Details'}
           </button>
        </div>
      `;

      const marker = L.marker([job.lat, job.lng], { icon: customIcon })
        .addTo(mapRef.current)
        .bindPopup(popupHTML, {
           closeButton: false,
           className: 'custom-job-popup',
           offset: [0, -50], 
           minWidth: 160
        });

      // Hover to open
      marker.on('mouseover', function (this: any) {
        this.openPopup();
      });

      markersRef.current.push(marker);
    });

    // Add User Marker
    if (userLocation) {
      mapRef.current.eachLayer((layer: any) => {
        if (layer.options.icon?.options?.className?.includes('custom-user-marker')) {
          mapRef.current.removeLayer(layer);
        }
      });

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div class="flex flex-col items-center">
             <div class="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow mb-1 font-bold whitespace-nowrap opacity-90 animate-bounce-slow">
               ${isUrdu ? 'میں' : 'Me'}
             </div>
             <div class="user-marker"></div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 35]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
    }

    return () => {
       if (mapContainer) {
          mapContainer.removeEventListener('click', handlePopupAction);
       }
    };
  }, [filteredJobs, userLocation, currentScreen, isUrdu]);

  // --- Handlers ---
  
  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setCurrentScreen('profileSetup');
  };

  const handleProfileSubmit = () => {
    if (!userProfile.name) {
      alert("Please enter your name / اپنا نام درج کریں");
      return;
    }
    if (!userProfile.city) {
      alert("Please enter your city / اپنا شہر درج کریں");
      return;
    }
    // Set default filter based on preference
    if (userProfile.categoryPreference && JOB_CATEGORIES.includes(userProfile.categoryPreference)) {
        setFilters(prev => ({ ...prev, category: userProfile.categoryPreference }));
    }
    setCurrentScreen('home');
  };

  const handleApply = () => {
    if (selectedJob) {
      const isAlreadyApplied = myAppliedJobs.some(job => job.id === selectedJob.id);
      
      if (!isAlreadyApplied) {
         const newAppliedJob: AppliedJob = {
          ...selectedJob,
          status: 'Applied',
          appliedDate: new Date().toLocaleDateString()
        };
        setMyAppliedJobs(prev => [newAppliedJob, ...prev]);
        alert(t.applySuccess);
      } else {
        alert("You have already applied for this job!");
      }
      setSelectedJob(null);
    }
  };

  const handleAIMatch = async () => {
    setIsLoadingAI(true);
    setCurrentScreen('aiMatch');
    const matches = await rankJobsWithAI(userProfile, MOCK_JOBS);
    setAiMatches(matches);
    setIsLoadingAI(false);
  };

  const handleCVGenerate = async () => {
    setIsLoadingAI(true);
    const cv = await generateCVContent(userProfile);
    setGeneratedCV(cv);
    setIsLoadingAI(false);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 16, { animate: true, duration: 1.5 });
      detectCity(userLocation.lat, userLocation.lng);
    } else {
      alert("Location waiting... Ensure GPS is on.");
    }
  };

  const handleToggleMode = () => {
    if (isEmployerMode) {
      setIsEmployerMode(false);
      setCurrentScreen('home');
    } else {
      setIsEmployerMode(true);
      setCurrentScreen('employerDashboard');
    }
  };

  // --- Screens ---

  const renderOnboarding = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-brand-600 dark:bg-slate-900 text-white text-center space-y-8 animate-in fade-in transition-colors duration-300">
      <div className="bg-white/20 p-6 rounded-full shadow-2xl animate-bounce-slow">
        <MapPin size={64} className="text-white" />
      </div>
      <div>
        <h1 className="text-4xl font-bold mb-2 font-urdu animate-in slide-in-from-bottom-4 duration-700">{t.appTitle}</h1>
        <p className="mt-2 text-brand-100 animate-in slide-in-from-bottom-4 duration-700 delay-100">{t.tagline}</p>
      </div>
      
      <div className="w-full max-w-xs space-y-4 animate-in slide-in-from-bottom-8 duration-1000 delay-200">
        <p className="text-sm opacity-90 mb-4">{t.selectLang}</p>
        <button 
          onClick={() => handleLanguageSelect(Language.URDU)} 
          className="w-full bg-white text-brand-600 py-4 rounded-xl font-bold text-xl font-urdu shadow-lg hover:bg-brand-50 transition active:scale-95"
        >
          اردو
        </button>
        <button 
          onClick={() => handleLanguageSelect(Language.ENGLISH)} 
          className="w-full bg-brand-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-brand-900 transition active:scale-95"
        >
          English
        </button>
      </div>
    </div>
  );

  const renderProfileSetup = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 animate-in slide-in-from-right">
       <div className="bg-brand-600 dark:bg-brand-800 p-8 pt-16 text-white rounded-b-[3rem] shadow-lg shrink-0">
         <h2 className="text-2xl font-bold mb-2">{t.setupProfile}</h2>
         <p className="text-brand-100 opacity-90">Let's find the best jobs for you.</p>
       </div>

       <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <User size={16} /> {t.name}
            </label>
            <input 
              type="text"
              value={userProfile.name}
              onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-lg"
              placeholder={isUrdu ? "مثال: علی خان" : "e.g. Ali Khan"}
            />
          </div>

           {/* Age & Gender */}
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.age}</label>
              <input 
                type="number"
                value={userProfile.age}
                onChange={(e) => setUserProfile({...userProfile, age: e.target.value})}
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="25"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.gender}</label>
              <div className="relative">
                <select 
                  value={userProfile.gender}
                  onChange={(e) => setUserProfile({...userProfile, gender: e.target.value})}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                  <option value="Male">{t.male}</option>
                  <option value="Female">{t.female}</option>
                  <option value="Other">{t.other}</option>
                </select>
                <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <MapPin size={16} /> {t.city}
            </label>
            <input 
              type="text"
              list="city-list"
              value={userProfile.city}
              onChange={(e) => setUserProfile({...userProfile, city: e.target.value})}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-lg"
              placeholder={isUrdu ? "شہر منتخب کریں" : "Select City"}
            />
            <datalist id="city-list">
              {Object.values(CITY_COORDINATES).map(c => <option key={c.label} value={c.label.split(',')[0]} />)}
            </datalist>
          </div>

          {/* Job Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Search size={16} /> {t.selectCategory}
            </label>
            <div className="relative">
                <input
                  type="text"
                  list="job-categories"
                  value={userProfile.categoryPreference}
                  onChange={(e) => setUserProfile({...userProfile, categoryPreference: e.target.value})}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-lg"
                  placeholder={isUrdu ? "مثال: ڈرائیور، الیکٹریشن..." : "e.g. Driver, Electrician..."}
                />
                <datalist id="job-categories">
                   {JOB_CATEGORIES.filter(c => c !== 'All').map(cat => (
                     <option key={cat} value={cat} />
                   ))}
                </datalist>
            </div>
          </div>

           {/* Education Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <GraduationCap size={16} /> {t.educationLevel}
            </label>
            <div className="relative">
              <select 
                value={userProfile.educationLevel}
                onChange={(e) => setUserProfile({...userProfile, educationLevel: e.target.value})}
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
              >
                <option value="None">{t.none}</option>
                <option value="Matric">{t.matric}</option>
                <option value="Inter">{t.inter}</option>
                <option value="Bachelors">{t.bachelors}</option>
                <option value="Masters">{t.masters}</option>
              </select>
              <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>

          {/* Shift & Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.shiftPreference}</label>
               <select 
                  value={userProfile.shiftPreference}
                  onChange={(e) => setUserProfile({...userProfile, shiftPreference: e.target.value})}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                  <option value="Morning">{t.morning}</option>
                  <option value="Evening">{t.evening}</option>
                  <option value="Night">{t.night}</option>
                  <option value="Any">{t.any}</option>
                </select>
            </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.hasTransport}</label>
               <select 
                  value={userProfile.hasTransport ? 'Yes' : 'No'}
                  onChange={(e) => setUserProfile({...userProfile, hasTransport: e.target.value === 'Yes'})}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
            </div>
          </div>

       </div>

       <div className="p-6 pb-8 safe-area-bottom shrink-0 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
         <Button fullWidth onClick={handleProfileSubmit} className="shadow-xl active:scale-95 transition-transform">
           {t.startSearching} <ArrowRight size={20} />
         </Button>
       </div>
    </div>
  );

  const renderEmployerDashboard = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="bg-brand-900 text-white p-6 pt-10 rounded-b-3xl shadow-lg shrink-0">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold flex items-center gap-2"><Briefcase /> {t.dashboard}</h2>
           <button onClick={handleToggleMode} className="text-xs bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition active:scale-90">
             {t.seekerMode}
           </button>
         </div>
         <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 p-3 rounded-xl">
               <div className="text-2xl font-bold">128</div>
               <div className="text-xs text-brand-200">{t.views}</div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl">
               <div className="text-2xl font-bold">12</div>
               <div className="text-xs text-brand-200">{t.applicants}</div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl">
               <div className="text-2xl font-bold">3</div>
               <div className="text-xs text-brand-200">{t.shortlisted}</div>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
         <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div>
               <h3 className="font-bold text-amber-900 dark:text-amber-100">{t.premium}</h3>
               <p className="text-xs text-amber-700 dark:text-amber-300">Boost your job posts by 10x.</p>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700 border-none text-xs py-2 px-3 active:scale-95">Upgrade</Button>
         </div>

         <div>
           <h3 className="font-bold text-gray-900 dark:text-white mb-3">Recent Applicants</h3>
           {MOCK_APPLICANTS.map(app => (
             <div key={app.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mb-3 shadow-sm flex items-center justify-between">
                <div>
                   <h4 className="font-bold text-gray-900 dark:text-white">{app.name}</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400">{app.role} • Match: <span className="text-green-600 font-bold">{app.matchScore}%</span></p>
                </div>
                <div className="flex gap-2">
                   <button className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 active:scale-90 transition"><Check size={16} /></button>
                   <button className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 active:scale-90 transition"><X size={16} /></button>
                </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );

  const renderJobsApplied = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
       <div className="bg-white dark:bg-slate-800 p-4 shadow-sm border-b dark:border-slate-700 flex items-center gap-3">
         <button onClick={() => setCurrentScreen('profile')} className="active:scale-90 transition"><ArrowLeft className={`dark:text-white ${isUrdu ? "rotate-180" : ""}`} /></button>
         <h2 className="font-bold text-lg dark:text-white">{t.jobsApplied}</h2>
       </div>

       <div className="flex-1 overflow-y-auto p-4 pb-24">
         {myAppliedJobs.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <div className="w-16 h-16 bg-gray-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Briefcase size={32} className="opacity-50" />
              </div>
              <p>{t.noApplications}</p>
              <Button variant="secondary" className="mt-4 active:scale-95" onClick={() => setCurrentScreen('home')}>
                {t.startSearching}
              </Button>
           </div>
         ) : (
           myAppliedJobs.map(job => (
             <div key={job.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mb-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-2">
                   <div>
                     <h3 className="font-bold text-gray-900 dark:text-white">{job.title}</h3>
                     <p className="text-xs text-gray-500 dark:text-gray-400">{job.company}</p>
                   </div>
                   <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider
                     ${job.status === 'Applied' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 
                       job.status === 'Shortlisted' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300' :
                       job.status === 'Rejected' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' :
                       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}
                   `}>
                     {job.status === 'Applied' ? t.statusApplied : 
                      job.status === 'Shortlisted' ? t.statusShortlisted :
                      job.status === 'Rejected' ? t.statusRejected : t.statusSeen}
                   </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t dark:border-slate-700">
                   <span className="flex items-center gap-1"><Clock3 size={12} /> {t.appliedOn}: {job.appliedDate}</span>
                   <span className="font-bold text-gray-700 dark:text-gray-300">{job.salary}</span>
                </div>
             </div>
           ))
         )}
       </div>
    </div>
  );

  const renderLearning = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm border-b dark:border-slate-700 sticky top-0 z-10 pt-8">
         <h2 className="font-bold text-xl flex items-center gap-2 dark:text-white">
           <GraduationCap className="text-brand-600" /> {t.courses}
         </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {MOCK_COURSES.map(course => (
          <div key={course.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition active:scale-[0.98] duration-200">
             <div className={`h-24 ${course.color} flex items-center justify-center`}>
                <Award className="text-white/50 w-16 h-16" />
             </div>
             <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{course.category}</span>
                   <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">{course.duration}</span>
                </div>
                <h3 className="font-bold text-lg mb-1 dark:text-white">{course.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{course.provider}</p>
                <Button variant="outline" fullWidth className="text-xs py-2 active:scale-95">{t.startCourse}</Button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
       <div className="bg-brand-600 dark:bg-brand-900 p-6 pt-10 text-white rounded-b-3xl shadow-lg shrink-0 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 animate-pulse" />
          
          <div className="relative z-10">
             <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-brand-600 shadow-xl border-4 border-brand-400">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{userProfile.name}</h2>
                  <p className="text-brand-100 text-sm mb-1">{userProfile.categoryPreference || 'Job Seeker'}</p>
                  {userProfile.isVerified ? (
                    <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-max font-bold"><CheckCircle size={10} /> Verified</span>
                  ) : (
                    <button className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 w-max transition active:scale-90">
                       {t.getVerified}
                    </button>
                  )}
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mt-8">
                <div 
                  onClick={() => setCurrentScreen('jobsApplied')}
                  className="bg-white/10 backdrop-blur-sm p-3 rounded-xl text-center border border-white/10 cursor-pointer hover:bg-white/20 transition active:scale-95"
                >
                   <span className="block text-2xl font-bold">{myAppliedJobs.length}</span>
                   <span className="text-xs text-brand-100">{t.jobsApplied}</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl text-center border border-white/10">
                   <span className="block text-2xl font-bold">5</span>
                   <span className="text-xs text-brand-100">{t.jobsSaved}</span>
                </div>
             </div>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          {/* Video Resume Section */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
             <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                   <Video size={18} className="text-purple-600" /> {t.videoResume}
                </h3>
                {userProfile.hasVideoResume && <CheckCircle size={16} className="text-green-500" />}
             </div>
             <div className="bg-gray-100 dark:bg-slate-700 rounded-xl h-32 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition active:scale-[0.98]">
                <PlayCircle size={32} className="mb-2 opacity-50" />
                <span className="text-xs font-medium">{t.uploadVideo}</span>
             </div>
          </div>

          <div className="space-y-2">
             <h3 className="font-bold text-gray-900 dark:text-white px-1">{t.editProfile}</h3>
             
             <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
                {/* Inputs */}
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">{t.name}</label>
                  <input className="w-full p-3 rounded-xl border bg-gray-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
                </div>
                {/* ... other profile inputs ... */}
             </div>
          </div>

          {/* Mode Switcher */}
          <div onClick={handleToggleMode} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-2xl shadow-lg cursor-pointer flex items-center justify-between active:scale-95 transition">
             <span className="font-bold flex items-center gap-2"><Briefcase size={18} /> {t.employerMode}</span>
             <ArrowRight size={18} />
          </div>
          
          {/* Dark Mode Toggle */}
           <div onClick={() => setIsDarkMode(!isDarkMode)} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer flex items-center justify-between active:scale-95 transition">
             <span className="font-bold flex items-center gap-2 dark:text-white">
               {isDarkMode ? <Sun size={18} /> : <Moon size={18} />} 
               {isDarkMode ? 'Light Mode' : 'Dark Mode'}
             </span>
          </div>

       </div>
    </div>
  );

  const renderHome = () => (
    <div className="h-full w-full relative">
      
      {/* Map Background */}
      <div id="map-container" ref={mapContainerRef} className="absolute inset-0 bg-gray-200 dark:bg-slate-800" />

      {/* Floating Functional Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex flex-col gap-3 animate-slide-in-from-top">
        
        {/* Dynamic City Name / Selector Badge */}
        <div className="relative self-center z-[501]">
          <button 
            onClick={() => setIsCitySelectorOpen(!isCitySelectorOpen)}
            className="bg-gray-900/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold border border-white/20 active:scale-95 transition-transform"
          >
             <MapPin size={14} className="text-brand-400" />
             {currentMapLocationName}
             <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${isCitySelectorOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCitySelectorOpen && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2">
              <div className="p-2 sticky top-0 bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                <span className="text-xs font-bold text-gray-500 uppercase px-2">Select Location</span>
              </div>
              {Object.entries(CITY_COORDINATES).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => handleCitySelect(key)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-slate-700 border-b border-gray-50 dark:border-slate-700 last:border-0 flex items-center justify-between active:bg-brand-100 transition"
                >
                  {data.label}
                  {currentMapLocationName === data.label && <Check size={14} className="text-brand-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-float flex items-center p-3 gap-3">
           <button onClick={() => setFilters(f => ({...f, category: 'All', onlyPartTime: false, onlyNearMe: false, minSalary: 0}))} className="text-gray-400 active:scale-90 transition">
             <MapPin size={24} className="text-brand-600" />
           </button>
           <input 
             type="text" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder={t.searchPlaceholder} 
             className={`flex-1 bg-transparent outline-none text-base dark:text-white ${isUrdu ? 'text-right' : ''}`}
           />
           <button 
             onClick={() => setShowFilterModal(true)}
             className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 active:scale-90 transition"
           >
             <Filter size={18} />
           </button>
        </div>
        
        {/* Active Filters Display */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.onlyNearMe && (
            <span className="bg-brand-600 text-white shadow-sm px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 animate-scale-in">
              Near Me <X size={12} onClick={() => setFilters(f => ({...f, onlyNearMe: false}))}/>
            </span>
          )}
          {filters.onlyPartTime && (
            <span className="bg-purple-600 text-white shadow-sm px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 animate-scale-in">
              Part Time <X size={12} onClick={() => setFilters(f => ({...f, onlyPartTime: false}))}/>
            </span>
          )}
           {filters.category !== 'All' && (
            <span className="bg-gray-800 text-white shadow-sm px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 animate-scale-in">
              {filters.category} <X size={12} onClick={() => setFilters(f => ({...f, category: 'All'}))}/>
            </span>
          )}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-28 z-[500] flex flex-col gap-3">
        <button 
          onClick={centerOnUser}
          className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-float text-blue-600 dark:text-blue-400 hover:text-blue-700 active:bg-blue-50 transition-transform active:scale-75 flex items-center justify-center gap-2"
        >
          <Crosshair size={24} />
        </button>
        
        <button 
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
          className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-float text-gray-600 dark:text-white hover:text-brand-600 active:bg-gray-50 transition-transform active:scale-75"
        >
           {viewMode === 'map' ? <List size={24} /> : <MapIcon size={24} />}
        </button>
      </div>

      {/* List View Overlay */}
      {viewMode === 'list' && (
        <div className="absolute inset-x-0 bottom-0 top-32 bg-gray-50 dark:bg-slate-900 rounded-t-3xl shadow-2xl z-[600] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
           <div className="w-12 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-2" />
           <div className="flex-1 overflow-y-auto p-4 pb-24">
             {filteredJobs.length > 0 ? (
                filteredJobs.map(job => (
                  <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} t={t} />
                ))
             ) : (
               <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                 No jobs found matching your filters.
               </div>
             )}
           </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="absolute inset-0 z-[1100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">{t.filters}</h3>
              <button onClick={() => setShowFilterModal(false)} className="active:scale-90 transition"><X className="text-gray-500 dark:text-gray-400" /></button>
            </div>
            
            <div className="space-y-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.category}</label>
                <select 
                  className="w-full p-3 bg-gray-50 dark:bg-slate-700 dark:text-white border dark:border-slate-600 rounded-xl"
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                >
                  {JOB_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                 <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl cursor-pointer active:bg-gray-100 dark:active:bg-slate-600 transition">
                    <span className="font-medium flex items-center gap-2 dark:text-white"><Briefcase size={18} /> {t.partTimeOnly}</span>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-brand-600"
                      checked={filters.onlyPartTime}
                      onChange={(e) => setFilters({...filters, onlyPartTime: e.target.checked})}
                    />
                 </label>

                 <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl cursor-pointer active:bg-gray-100 dark:active:bg-slate-600 transition">
                    <span className="font-medium flex items-center gap-2 dark:text-white"><MapPin size={18} /> {t.nearMe}</span>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-brand-600"
                      checked={filters.onlyNearMe}
                      onChange={(e) => setFilters({...filters, onlyNearMe: e.target.checked})}
                    />
                 </label>
              </div>

              {/* Salary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.minSalary}: {filters.minSalary || 'Any'}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100000" 
                  step="5000"
                  value={filters.minSalary}
                  onChange={(e) => setFilters({...filters, minSalary: Number(e.target.value)})}
                  className="w-full accent-brand-600"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setFilters({category: 'All', onlyPartTime: false, minSalary: 0, onlyNearMe: false})}>
                  {t.clear}
                </Button>
                <Button fullWidth onClick={() => setShowFilterModal(false)} className="active:scale-95">
                  {t.applyFilters}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  const renderJobDetails = () => {
    if (!selectedJob) return null;
    return (
      <div className="absolute inset-0 bg-white dark:bg-slate-900 z-[1000] overflow-y-auto animate-in slide-in-from-bottom duration-300 flex flex-col">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-4 shadow-sm z-10">
          <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full dark:text-white active:scale-90 transition">
            <ArrowLeft size={24} className={isUrdu ? "rotate-180" : ""} />
          </button>
          <h2 className="font-bold text-lg dark:text-white">{t.jobDetails}</h2>
        </div>
        
        <div className="p-5 flex-1 pb-24">
          <div className="bg-white dark:bg-slate-900 rounded-2xl mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedJob.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-4 flex items-center gap-1">
               <Briefcase size={16} /> {selectedJob.company}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
               <span className="bg-gray-100 dark:bg-slate-800 dark:text-gray-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                 <MapPin size={14} /> {selectedJob.locationName}
               </span>
               <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-lg text-sm font-bold">
                 {selectedJob.salary}
               </span>
               <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-sm">
                 {selectedJob.type}
               </span>
               {selectedJob.isPremium && (
                   <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1">
                     <Star size={12} fill="currentColor"/> Premium
                   </span>
               )}
            </div>

            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="flex gap-2 items-center justify-center py-2 active:scale-95" onClick={() => window.open(`tel:${selectedJob.contactPhone || '03000000000'}`)}>
                    <Phone size={18} /> {t.callNow}
                  </Button>
                  <Button variant="secondary" className="flex gap-2 items-center justify-center py-2 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-400 active:scale-95" onClick={() => window.open(`https://wa.me/${selectedJob.contactPhone?.replace(/\D/g,'') || '923000000000'}`)}>
                    <MessageCircle size={18} /> WhatsApp
                  </Button>
               </div>

               <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl">
                 <h3 className={`font-bold text-gray-900 dark:text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>{t.description}</h3>
                 <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{selectedJob.description}</p>
               </div>

               {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                 <div>
                    <h3 className={`font-bold text-gray-900 dark:text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>{t.benefits}</h3>
                    <div className="flex flex-wrap gap-2">
                       {selectedJob.benefits.map((benefit, i) => (
                         <span key={i} className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold border border-purple-100 dark:border-purple-800">
                           {benefit}
                         </span>
                       ))}
                    </div>
                 </div>
               )}
               
               <div>
                 <h3 className={`font-bold text-gray-900 dark:text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>{t.requirements}</h3>
                 <ul className="space-y-2">
                    {selectedJob.requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                        <CheckCircle size={14} className="text-brand-500" />
                        {req}
                      </li>
                    ))}
                 </ul>
               </div>

               <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                 <ShieldAlert size={20} className="shrink-0" />
                 <p>{t.fraudWarning}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t dark:border-slate-700 p-4 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
           <Button fullWidth onClick={handleApply} className="active:scale-95">
             {t.apply}
           </Button>
        </div>
      </div>
    );
  };

  const renderAIMatch = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
       <div className="bg-white dark:bg-slate-800 p-4 shadow-sm border-b dark:border-slate-700 flex items-center gap-3 sticky top-0 z-10">
         <button onClick={() => setCurrentScreen('home')} className="active:scale-90 transition"><ArrowLeft className={`dark:text-white ${isUrdu ? "rotate-180" : ""}`} /></button>
         <h2 className="font-bold text-lg flex items-center gap-2 dark:text-white">
           <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 p-1 rounded"><Search size={16} /></span>
           {t.topMatches}
         </h2>
       </div>

       <div className="p-4 overflow-y-auto pb-24">
         {isLoadingAI ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-500">
             <Loader2 className="animate-spin mb-4 text-brand-500" size={40} />
             <p>{t.generating}</p>
           </div>
         ) : (
           <div className="space-y-6">
             {aiMatches.length > 0 ? (
               aiMatches.map((match, idx) => {
                 const job = MOCK_JOBS.find(j => j.id === match.jobId);
                 if (!job) return null;
                 return (
                   <div key={match.jobId} className="relative">
                     <div className="absolute -left-2 -top-2 bg-gradient-to-br from-purple-500 to-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg z-10 border-2 border-white dark:border-slate-800">
                       #{idx + 1}
                     </div>
                     <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-4 border border-indigo-100 dark:border-slate-700 mb-2">
                       <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase mb-1 tracking-wider">AI Insight</p>
                       <p className="text-indigo-900 dark:text-indigo-200 text-sm italic">"{match.reason}"</p>
                     </div>
                     <JobCard job={job} onClick={() => setSelectedJob(job)} t={t} />
                   </div>
                 );
               })
             ) : (
               <div className="text-center py-10 text-gray-500">
                 No strong matches found today. Try updating your profile skills.
               </div>
             )}
           </div>
         )}
       </div>
    </div>
  );

  const renderCVBuilder = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm border-b dark:border-slate-700 flex items-center gap-3">
         <button onClick={() => setCurrentScreen('home')} className="active:scale-90 transition"><ArrowLeft className={`dark:text-white ${isUrdu ? "rotate-180" : ""}`} /></button>
         <h2 className="font-bold text-lg dark:text-white">{t.cvBuilder}</h2>
       </div>
       
       <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.name}</label>
               <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
             </div>
             {/* ... (CV fields follow same pattern) ... */}
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.phone}</label>
                   <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.phone} onChange={e => setUserProfile({...userProfile, phone: e.target.value})} placeholder="0300..." />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.email}</label>
                   <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.email} onChange={e => setUserProfile({...userProfile, email: e.target.value})} placeholder="@..." />
                </div>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.address}</label>
               <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.address} onChange={e => setUserProfile({...userProfile, address: e.target.value})} placeholder="City, Area" />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.skills}</label>
               <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.skills.join(', ')} onChange={e => setUserProfile({...userProfile, skills: e.target.value.split(', ')})} />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.experience}</label>
               <textarea className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white h-24" value={userProfile.experience} onChange={e => setUserProfile({...userProfile, experience: e.target.value})} />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.education}</label>
               <input className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white" value={userProfile.education} onChange={e => setUserProfile({...userProfile, education: e.target.value})} />
             </div>

             <Button fullWidth onClick={handleCVGenerate} disabled={isLoadingAI} className="active:scale-95">
               {isLoadingAI ? <Loader2 className="animate-spin" /> : <FileText size={18} />}
               {isLoadingAI ? t.generating : t.generateCV}
             </Button>
          </div>

          {generatedCV && !isLoadingAI && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-800 dark:text-white">Generated Resume</h3>
                <button className="text-brand-600 dark:text-brand-400 text-sm font-medium flex items-center gap-1 active:scale-90 transition">
                  <Download size={14} /> {t.download}
                </button>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border dark:border-slate-700 text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
                {generatedCV}
              </div>
            </div>
          )}
       </div>
    </div>
  );

  const renderPostJob = () => (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
       <div className="bg-white dark:bg-slate-800 p-4 shadow-sm border-b dark:border-slate-700 flex items-center gap-3">
         <button onClick={() => setCurrentScreen('employerDashboard')} className="active:scale-90 transition"><ArrowLeft className={`dark:text-white ${isUrdu ? "rotate-180" : ""}`} /></button>
         <h2 className="font-bold text-lg dark:text-white">{t.postJob}</h2>
       </div>
       <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto">
              <PlusCircle size={32} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p>Post Job Feature coming soon...</p>
            <Button variant="secondary" onClick={() => setCurrentScreen('employerDashboard')} className="active:scale-95">{t.back}</Button>
          </div>
       </div>
    </div>
  );

  // Bottom Navigation
  const BottomNav = () => (
    <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 absolute bottom-0 w-full left-0 right-0 flex justify-around py-2 pb-5 shadow-lg safe-area-bottom z-[900] text-[10px] font-medium text-gray-500 dark:text-gray-400">
      
      {/* Employer Nav */}
      {isEmployerMode ? (
        <>
          <button onClick={() => setCurrentScreen('employerDashboard')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'employerDashboard' ? 'text-brand-600 dark:text-brand-400' : ''}`}>
             <div className={`p-1.5 rounded-full ${currentScreen === 'employerDashboard' ? 'bg-brand-50 dark:bg-brand-900/30 animate-bounce-subtle' : ''}`}><BarChart size={22} /></div>
             {t.dashboard}
          </button>
          
           <div className="relative -top-6">
            <button onClick={() => setCurrentScreen('postJob')} className="bg-brand-600 text-white p-4 rounded-full shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-90 transition">
              <PlusCircle size={24} />
            </button>
          </div>

          <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'profile' ? 'text-brand-600 dark:text-brand-400' : ''}`}>
             <div className={`p-1.5 rounded-full ${currentScreen === 'profile' ? 'bg-brand-50 dark:bg-brand-900/30 animate-bounce-subtle' : ''}`}><User size={22} /></div>
             {t.profile}
          </button>
        </>
      ) : (
        /* Job Seeker Nav */
        <>
          <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'home' ? 'text-brand-600 dark:text-brand-400' : ''}`}>
            <div className={`p-1.5 rounded-full ${currentScreen === 'home' ? 'bg-brand-50 dark:bg-brand-900/30 animate-bounce-subtle' : ''}`}><Home size={22} strokeWidth={currentScreen === 'home' ? 2.5 : 2} /></div>
            {t.map}
          </button>
          
          <button onClick={handleAIMatch} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'aiMatch' ? 'text-purple-600 dark:text-purple-400' : ''}`}>
            <div className={`p-1.5 rounded-full ${currentScreen === 'aiMatch' ? 'bg-purple-100 dark:bg-purple-900/30 animate-bounce-subtle' : ''}`}><Search size={22} strokeWidth={currentScreen === 'aiMatch' ? 2.5 : 2} /></div>
            {t.aiMatch}
          </button>

          <button onClick={() => setCurrentScreen('learn')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'learn' ? 'text-orange-600 dark:text-orange-400' : ''}`}>
            <div className={`p-1.5 rounded-full ${currentScreen === 'learn' ? 'bg-orange-100 dark:bg-orange-900/30 animate-bounce-subtle' : ''}`}><GraduationCap size={22} strokeWidth={currentScreen === 'learn' ? 2.5 : 2} /></div>
            {t.learn}
          </button>

          <button onClick={() => setCurrentScreen('cvBuilder')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'cvBuilder' ? 'text-brand-600 dark:text-brand-400' : ''}`}>
             <div className={`p-1.5 rounded-full ${currentScreen === 'cvBuilder' ? 'bg-brand-50 dark:bg-brand-900/30 animate-bounce-subtle' : ''}`}><FileText size={22} strokeWidth={currentScreen === 'cvBuilder' ? 2.5 : 2} /></div>
            {t.cvBuilder}
          </button>

          <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center gap-1 transition-transform active:scale-75 duration-200 ${currentScreen === 'profile' ? 'text-brand-600 dark:text-brand-400' : ''}`}>
             <div className={`p-1.5 rounded-full ${currentScreen === 'profile' ? 'bg-brand-50 dark:bg-brand-900/30 animate-bounce-subtle' : ''}`}><User size={22} strokeWidth={currentScreen === 'profile' ? 2.5 : 2} /></div>
            {t.profile}
          </button>
        </>
      )}
    </div>
  );

  // MessageCircle Icon manual definition since it might not be in the initial import set and I want to use it for WhatsApp
  const MessageCircle = ({ size = 24, className = "" }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );

  // --- Main Render ---
  
  return (
    <div className={`h-full w-full bg-gray-100 dark:bg-black flex items-center justify-center text-slate-900 dark:text-white transition-colors duration-300 ${isUrdu ? 'rtl' : 'ltr'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
      
      {/* Tablet Mode Toggle for Desktop/Laptop Users */}
      <button 
        onClick={() => setIsTabletMode(!isTabletMode)}
        className="fixed top-6 right-6 z-[9999] hidden md:flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-full shadow-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all font-bold transform hover:scale-105 active:scale-95"
      >
        {isTabletMode ? <Smartphone size={20} /> : <Tablet size={20} />}
        {isTabletMode ? 'Mobile View' : 'Tablet Mode'}
      </button>

      {/* Main App Wrapper */}
      <div className={`
        bg-white dark:bg-slate-900 shadow-2xl overflow-hidden relative font-sans transition-all duration-500 ease-in-out
        ${isTabletMode 
           ? 'w-[90vw] h-[85vh] rounded-[2rem] border-8 border-gray-800 dark:border-gray-600 max-w-5xl' 
           : 'w-full max-w-md h-full'
        }
      `}>
        
        {currentScreen === 'onboarding' && renderOnboarding()}
        
        {currentScreen === 'profileSetup' && renderProfileSetup()}
        
        {currentScreen === 'home' && (
          <>
            {renderHome()}
            <BottomNav />
            {renderJobDetails()}
          </>
        )}

        {currentScreen === 'aiMatch' && (
          <>
            {renderAIMatch()}
            <BottomNav />
            {renderJobDetails()}
          </>
        )}

        {currentScreen === 'learn' && (
          <>
            {renderLearning()}
            <BottomNav />
          </>
        )}

        {currentScreen === 'cvBuilder' && (
          <>
            {renderCVBuilder()}
            <BottomNav />
          </>
        )}

        {currentScreen === 'profile' && (
          <>
            {renderProfile()}
            <BottomNav />
          </>
        )}

        {currentScreen === 'jobsApplied' && (
          <>
            {renderJobsApplied()}
            <BottomNav />
          </>
        )}

        {currentScreen === 'employerDashboard' && (
          <>
            {renderEmployerDashboard()}
            <BottomNav />
          </>
        )}

        {currentScreen === 'postJob' && (
          <>
            {renderPostJob()}
            <BottomNav />
          </>
        )}

      </div>
    </div>
  );
};

export default App;
