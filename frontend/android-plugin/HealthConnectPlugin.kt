package com.nalamudan.healthtracker

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

@CapacitorPlugin(name = "HealthConnectPlugin")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO)
    private val fmt   = DateTimeFormatter.ISO_INSTANT

    private fun getClient(): HealthConnectClient? {
        val status = HealthConnectClient.getSdkStatus(context)
        return if (status == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context)
        else null
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val res = JSObject()
        res.put("status", when (status) {
            HealthConnectClient.SDK_AVAILABLE -> "AVAILABLE"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "NOT_INSTALLED"
            else -> "NOT_SUPPORTED"
        })
        call.resolve(res)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val client = getClient() ?: run { call.reject("Health Connect not available"); return }
        val permissions = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(RespiratoryRateRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(Vo2MaxRecord::class),
        )
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                val notGranted = permissions - granted
                if (notGranted.isNotEmpty()) {
                    val intent = client.permissionController
                        .createRequestPermissionResultContract()
                        .createIntent(context, permissions)
                    activity.startActivityForResult(intent, 1001)
                }
                val arr = JSArray()
                granted.forEach { arr.put(it) }
                val res = JSObject(); res.put("granted", arr)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Permission request failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getGrantedPermissions(call: PluginCall) {
        val client = getClient() ?: run {
            val res = JSObject(); res.put("granted", JSArray()); call.resolve(res); return
        }
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                val arr = JSArray()
                granted.forEach { arr.put(it) }
                val res = JSObject(); res.put("granted", arr)
                call.resolve(res)
            } catch (e: Exception) {
                val res = JSObject(); res.put("granted", JSArray()); call.resolve(res)
            }
        }
    }

    @PluginMethod
    fun readHealthData(call: PluginCall) {
        val client = getClient() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val records = JSArray()

                // Steps
                client.readRecords(ReadRecordsRequest(StepsRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "steps"); put("value", r.count.toDouble()); put("unit", "steps")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // Heart rate
                client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records.forEach { r ->
                    r.samples.forEach { s ->
                        records.put(JSObject().apply {
                            put("type", "heart_rate"); put("value", s.beatsPerMinute.toDouble()); put("unit", "bpm")
                            put("startTime", fmt.format(s.time))
                            put("uid", "${r.metadata.id}_${s.time.epochSecond}")
                            put("dataOrigin", r.metadata.dataOrigin.packageName)
                        })
                    }
                }

                // Resting heart rate
                client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "resting_heart_rate"); put("value", r.beatsPerMinute.toDouble()); put("unit", "bpm")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // HRV
                client.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "heart_rate_variability"); put("value", r.heartRateVariabilityMillis); put("unit", "ms")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // SpO2
                client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "oxygen_saturation"); put("value", r.percentage.value); put("unit", "%")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // Respiratory rate
                client.readRecords(ReadRecordsRequest(RespiratoryRateRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "respiratory_rate"); put("value", r.rate); put("unit", "rpm")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // Active calories
                client.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "active_calories"); put("value", r.energy.inKilocalories); put("unit", "kcal")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // Distance
                client.readRecords(ReadRecordsRequest(DistanceRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "distance"); put("value", r.distance.inKilometers); put("unit", "km")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                // VO2 max
                client.readRecords(ReadRecordsRequest(Vo2MaxRecord::class, filter)).records.forEach { r ->
                    records.put(JSObject().apply {
                        put("type", "vo2_max"); put("value", r.vo2MillilitersPerMinuteKilogram); put("unit", "ml/kg/min")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                val res = JSObject(); res.put("records", records)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read health data: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readSleepSessions(call: PluginCall) {
        val client = getClient() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val sessions = JSArray()
                client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records.forEach { r ->
                    val durationMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                    var awake = 0.0; var light = 0.0; var deep = 0.0; var rem = 0.0
                    r.stages.forEach { stage ->
                        val mins = (stage.endTime.epochSecond - stage.startTime.epochSecond) / 60.0
                        when (stage.stage) {
                            SleepSessionRecord.STAGE_TYPE_AWAKE -> awake += mins
                            SleepSessionRecord.STAGE_TYPE_LIGHT -> light += mins
                            SleepSessionRecord.STAGE_TYPE_DEEP  -> deep  += mins
                            SleepSessionRecord.STAGE_TYPE_REM   -> rem   += mins
                        }
                    }
                    sessions.put(JSObject().apply {
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("durationMinutes", durationMin)
                        if (awake > 0) put("awakeMinutes", awake)
                        if (light > 0) put("lightSleepMinutes", light)
                        if (deep  > 0) put("deepSleepMinutes",  deep)
                        if (rem   > 0) put("remSleepMinutes",   rem)
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }
                val res = JSObject(); res.put("sessions", sessions)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read sleep data: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readWorkouts(call: PluginCall) {
        val client = getClient() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val workouts = JSArray()
                client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter)).records.forEach { r ->
                    val durationMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                    workouts.put(JSObject().apply {
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("durationMinutes", durationMin)
                        put("exerciseType", r.exerciseType.toString())
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }
                val res = JSObject(); res.put("workouts", workouts)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read workouts: ${e.message}")
            }
        }
    }
}
