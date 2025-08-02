import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Zap, Activity, Clock } from "lucide-react";

interface PerformanceOptimizerProps {
  onOptimize?: () => void;
}

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  eventCount: number;
  fps: number;
}

export function PerformanceOptimizer({ onOptimize }: PerformanceOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [optimizationLevel, setOptimizationLevel] = useState<'low' | 'medium' | 'high'>('medium');
  
  // Simulate performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      // Generate random performance metrics
      setMetrics({
        renderTime: Math.floor(Math.random() * 50) + 10, // 10-60ms
        memoryUsage: Math.floor(Math.random() * 50) + 30, // 30-80%
        eventCount: Math.floor(Math.random() * 200) + 50, // 50-250 events
        fps: Math.floor(Math.random() * 30) + 30 // 30-60 FPS
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  const runOptimization = () => {
    setIsOptimizing(true);
    
    // Simulate optimization process
    setTimeout(() => {
      setIsOptimizing(false);
      
      // Update metrics after optimization
      setMetrics({
        renderTime: Math.floor(Math.random() * 20) + 5, // 5-25ms
        memoryUsage: Math.floor(Math.random() * 30) + 20, // 20-50%
        eventCount: Math.floor(Math.random() * 200) + 50, // 50-250 events
        fps: Math.floor(Math.random() * 20) + 50 // 50-70 FPS
      });
      
      if (onOptimize) {
        onOptimize();
      }
    }, 2000);
  };
  
  const getPerformanceStatus = (fps: number) => {
    if (fps >= 55) return { status: 'excellent', color: 'bg-green-500' };
    if (fps >= 45) return { status: 'good', color: 'bg-blue-500' };
    if (fps >= 30) return { status: 'fair', color: 'bg-yellow-500' };
    return { status: 'poor', color: 'bg-red-500' };
  };
  
  return (
    <Card className="neu-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          Performance Optimization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Monitor and optimize calendar performance for smooth user experience.
          </p>
          
          {metrics && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Render Time</span>
                  <Badge variant="secondary">{metrics.renderTime}ms</Badge>
                </div>
                <Progress value={Math.min(100, metrics.renderTime)} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <Badge variant="secondary">{metrics.memoryUsage}%</Badge>
                </div>
                <Progress value={metrics.memoryUsage} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Event Count</span>
                  <Badge variant="secondary">{metrics.eventCount}</Badge>
                </div>
                <Progress value={Math.min(100, metrics.eventCount / 3)} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Frame Rate</span>
                  <Badge variant="secondary">{metrics.fps} FPS</Badge>
                </div>
                <Progress 
                  value={Math.min(100, (metrics.fps / 70) * 100)} 
                  className="h-2"
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Optimization Level</span>
            </div>
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <Button
                  key={level}
                  variant={optimizationLevel === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptimizationLevel(level)}
                  className="neu-card text-xs"
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          
          <Button
            onClick={runOptimization}
            disabled={isOptimizing}
            className="neu-card w-full"
          >
            {isOptimizing ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Optimizing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Run Performance Optimization
              </div>
            )}
          </Button>
          
          {metrics && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-1">Optimization Tips</h4>
              <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
                <li>Enable virtualization for grids with many events</li>
                <li>Debounce expensive operations like rendering</li>
                <li>Cache computed values to avoid re-calculations</li>
                <li>Use React.memo for components that render frequently</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}