import React from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';

const Portfolio = () => {
  const projects = [
    {
      title: "TechFlow Solutions",
      category: "B2B SaaS",
      description: "Complete brand transformation and digital marketing strategy that increased lead generation by 400%.",
      image: "https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=600",
      metrics: [
        { label: "Lead Growth", value: "400%" },
        { label: "Conversion Rate", value: "12.5%" }
      ]
    },
    {
      title: "GreenEarth Eco",
      category: "E-commerce",
      description: "Sustainable brand positioning and social media campaign that drove $2M in sales within 6 months.",
      image: "https://images.pexels.com/photos/3184357/pexels-photo-3184357.jpeg?auto=compress&cs=tinysrgb&w=600",
      metrics: [
        { label: "Sales Revenue", value: "$2M" },
        { label: "Social Reach", value: "50K+" }
      ]
    },
    {
      title: "UrbanFit Lifestyle",
      category: "Health & Wellness",
      description: "Comprehensive digital transformation including web redesign and influencer marketing campaigns.",
      image: "https://images.pexels.com/photos/3184297/pexels-photo-3184297.jpeg?auto=compress&cs=tinysrgb&w=600",
      metrics: [
        { label: "User Engagement", value: "250%" },
        { label: "App Downloads", value: "100K+" }
      ]
    }
  ];

  return (
    <section id="portfolio" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-sky-400">Portfolio</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover how we've helped businesses across various industries achieve remarkable 
            growth through strategic marketing and creative excellence.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <div key={index} className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="relative overflow-hidden">
                <img 
                  src={project.image} 
                  alt={project.title}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-yellow-400 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {project.category}
                  </span>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white p-2 rounded-full shadow-lg">
                    <ExternalLink className="h-4 w-4 text-gray-700" />
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{project.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{project.description}</p>
                
                <div className="flex items-center justify-between">
                  {project.metrics.map((metric, idx) => (
                    <div key={idx} className="text-center">
                      <div className="flex items-center text-sky-500 mb-1">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span className="font-bold text-lg text-gray-800">{metric.value}</span>
                      </div>
                      <p className="text-gray-600 text-sm">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="bg-gradient-to-r from-yellow-400 to-sky-400 text-white px-8 py-4 rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200">
            View All Projects
          </button>
        </div>
      </div>
    </section>
  );
};

export default Portfolio;