package com.cardvault.security

import android.app.Activity
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import java.lang.ref.WeakReference

object PrivacyController {
  private var activityReference = WeakReference<Activity>(null)
  private var shield: FrameLayout? = null
  private var learningListener: ViewTreeObserver.OnGlobalLayoutListener? = null

  fun attach(activity: Activity) {
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    if (activityReference.get() !== activity) {
      activityReference.get()?.let { detach(it) }
      activityReference = WeakReference(activity)
      val decor = activity.window.decorView
      learningListener = ViewTreeObserver.OnGlobalLayoutListener { preventKeyboardLearning(decor) }
      decor.viewTreeObserver.addOnGlobalLayoutListener(learningListener)
    }
  }

  private fun preventKeyboardLearning(view: View) {
    if (view is EditText) {
      view.imeOptions = view.imeOptions or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) preventKeyboardLearning(view.getChildAt(index))
    }
  }

  fun detach(activity: Activity) {
    if (activityReference.get() !== activity) return
    learningListener?.let { activity.window.decorView.viewTreeObserver.removeOnGlobalLayoutListener(it) }
    (shield?.parent as? ViewGroup)?.removeView(shield)
    shield = null
    learningListener = null
    activityReference.clear()
  }

  fun obscure(activity: Activity) {
    attach(activity)
    ClipboardExpiryController.clearOwned(activity.applicationContext)
    val decor = activity.window.decorView as? ViewGroup ?: return
    val cover = shield ?: FrameLayout(activity).apply {
      setBackgroundColor(Color.rgb(11, 17, 27))
      isClickable = true
      isFocusable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      addView(TextView(activity).apply {
        text = "CARDVAULT\n\nYour private space."
        setTextColor(Color.WHITE)
        textSize = 20f
        gravity = Gravity.CENTER
      }, FrameLayout.LayoutParams(-1, -1))
      decor.addView(this, ViewGroup.LayoutParams(-1, -1))
      shield = this
    }
    cover.visibility = View.VISIBLE
    cover.bringToFront()
  }

  fun reveal(activity: Activity) {
    if (activity.hasWindowFocus()) {
      ClipboardExpiryController.clearOwned(activity.applicationContext)
      shield?.visibility = View.GONE
    }
  }
}
